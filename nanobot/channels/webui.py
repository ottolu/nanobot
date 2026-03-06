"""WebUI channel implementation using FastAPI + WebSocket."""

import asyncio
import json
import uuid
from pathlib import Path
from typing import Any

from loguru import logger

from nanobot.bus.events import OutboundMessage
from nanobot.bus.queue import MessageBus
from nanobot.channels.base import BaseChannel
from nanobot.config.schema import WebUIConfig


class WebUIChannel(BaseChannel):
    """
    WebUI channel providing a browser-based chat interface.

    Embeds a FastAPI application with:
    - WebSocket endpoint for real-time chat
    - REST APIs for session management and status
    - Static file serving for the frontend SPA
    """

    name = "webui"

    def __init__(self, config: WebUIConfig, bus: MessageBus):
        super().__init__(config, bus)
        self.config: WebUIConfig = config

        # WebSocket connection registry: ws_id -> WebSocket
        self._connections: dict[str, Any] = {}
        # Map session_id -> set of ws_ids subscribed to that session
        self._session_subs: dict[str, set[str]] = {}
        # Map ws_id -> session_id (current active session per connection)
        self._ws_session: dict[str, str] = {}

        self._app = None
        self._server = None

    def _build_app(self):
        """Build the FastAPI application with all routes."""
        from fastapi import FastAPI, WebSocket, WebSocketDisconnect
        from fastapi.responses import JSONResponse
        from fastapi.staticfiles import StaticFiles

        app = FastAPI(title="nanobot WebUI", docs_url=None, redoc_url=None)

        # ── WebSocket endpoint ──────────────────────────────────────────

        @app.websocket("/ws")
        async def websocket_endpoint(websocket: WebSocket):
            await websocket.accept()
            ws_id = str(uuid.uuid4())
            self._connections[ws_id] = websocket
            logger.info("WebUI WebSocket connected: {}", ws_id)

            try:
                while True:
                    raw = await websocket.receive_text()
                    try:
                        data = json.loads(raw)
                    except json.JSONDecodeError:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "content": "Invalid JSON",
                        }))
                        continue

                    msg_type = data.get("type")

                    if msg_type == "message":
                        await self._handle_ws_message(ws_id, data)
                    elif msg_type == "ping":
                        await websocket.send_text(json.dumps({"type": "pong"}))
                    else:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "content": f"Unknown message type: {msg_type}",
                        }))

            except WebSocketDisconnect:
                logger.info("WebUI WebSocket disconnected: {}", ws_id)
            except Exception as e:
                logger.error("WebUI WebSocket error ({}): {}", ws_id, e)
            finally:
                self._cleanup_ws(ws_id)

        # ── REST: session list ──────────────────────────────────────────

        @app.get("/api/sessions")
        async def list_sessions():
            """List all webui sessions from the session manager."""
            try:
                from nanobot.session.manager import SessionManager
                workspace = Path(self.config.workspace or "~/.nanobot/workspace").expanduser()
                sm = SessionManager(workspace)
                all_sessions = sm.list_sessions()
                # Filter to webui sessions only
                webui_sessions = [
                    s for s in all_sessions
                    if (s.get("key") or "").startswith("webui:")
                ]
                return JSONResponse({"sessions": webui_sessions})
            except Exception as e:
                logger.error("Failed to list sessions: {}", e)
                return JSONResponse({"sessions": [], "error": str(e)})

        # ── REST: session detail / delete ───────────────────────────────

        @app.get("/api/sessions/{session_id}")
        async def get_session(session_id: str):
            """Get session details including message history."""
            try:
                from nanobot.session.manager import SessionManager
                workspace = Path(self.config.workspace or "~/.nanobot/workspace").expanduser()
                sm = SessionManager(workspace)
                session_key = f"webui:{session_id}"
                session = sm._load(session_key)
                if session is None:
                    return JSONResponse({"error": "Session not found"}, status_code=404)
                return JSONResponse({
                    "session": {
                        "key": session.key,
                        "created_at": session.created_at.isoformat(),
                        "updated_at": session.updated_at.isoformat(),
                        "messages": [
                            {
                                "role": m.get("role"),
                                "content": m.get("content", ""),
                                "timestamp": m.get("timestamp"),
                            }
                            for m in session.messages
                        ],
                        "metadata": session.metadata,
                    }
                })
            except Exception as e:
                logger.error("Failed to get session {}: {}", session_id, e)
                return JSONResponse({"error": str(e)}, status_code=500)

        @app.delete("/api/sessions/{session_id}")
        async def delete_session(session_id: str):
            """Delete a session by removing its file."""
            try:
                from nanobot.session.manager import SessionManager
                workspace = Path(self.config.workspace or "~/.nanobot/workspace").expanduser()
                sm = SessionManager(workspace)
                session_key = f"webui:{session_id}"
                path = sm._get_session_path(session_key)
                if path.exists():
                    path.unlink()
                    sm.invalidate(session_key)
                    return JSONResponse({"ok": True})
                else:
                    return JSONResponse({"error": "Session not found"}, status_code=404)
            except Exception as e:
                logger.error("Failed to delete session {}: {}", session_id, e)
                return JSONResponse({"error": str(e)}, status_code=500)

        # ── REST: status ────────────────────────────────────────────────

        @app.get("/api/status")
        async def get_status():
            return JSONResponse({
                "channel": self.name,
                "running": self._running,
                "connections": len(self._connections),
                "sessions": list(self._session_subs.keys()),
            })

        # ── Static files (frontend SPA) ────────────────────────────────
        # Mount at /app to avoid catch-all "/" stealing WebSocket routes.

        static_dir = Path(__file__).parent.parent / "webui" / "static"
        if static_dir.is_dir():
            from starlette.responses import RedirectResponse

            @app.get("/")
            async def root():
                return RedirectResponse(url="/app/")

            app.mount("/app", StaticFiles(directory=str(static_dir), html=True), name="static")
        else:
            logger.debug("WebUI static dir not found at {}, skipping static mount", static_dir)

            @app.get("/")
            async def root():
                return JSONResponse({
                    "message": "nanobot WebUI API is running. Frontend not built yet.",
                    "hint": "Place built frontend files in nanobot/webui/static/",
                })

        self._app = app
        return app

    # ── WebSocket message handling ──────────────────────────────────────

    async def _handle_ws_message(self, ws_id: str, data: dict) -> None:
        """Handle an incoming chat message from a WebSocket client."""
        content = data.get("content", "").strip()
        session_id = data.get("session_id") or str(uuid.uuid4())

        if not content:
            ws = self._connections.get(ws_id)
            if ws:
                await ws.send_text(json.dumps({
                    "type": "error",
                    "content": "Empty message",
                }))
            return

        # Subscribe this ws to the session
        self._ws_session[ws_id] = session_id
        if session_id not in self._session_subs:
            self._session_subs[session_id] = set()
        self._session_subs[session_id].add(ws_id)

        # Build sender_id and chat_id in the standard channel format
        sender_id = f"webui:{session_id}"
        chat_id = session_id

        logger.debug("WebUI message from session {}: {}...", session_id, content[:50])

        # Forward to the message bus via BaseChannel._handle_message
        await self._handle_message(
            sender_id=sender_id,
            chat_id=chat_id,
            content=content,
            metadata={"ws_id": ws_id, "session_id": session_id},
        )

    def _cleanup_ws(self, ws_id: str) -> None:
        """Remove a WebSocket connection from all registries."""
        self._connections.pop(ws_id, None)
        session_id = self._ws_session.pop(ws_id, None)
        if session_id and session_id in self._session_subs:
            self._session_subs[session_id].discard(ws_id)
            if not self._session_subs[session_id]:
                del self._session_subs[session_id]

    # ── BaseChannel interface ───────────────────────────────────────────

    async def start(self) -> None:
        """Start the FastAPI server with uvicorn."""
        import uvicorn

        app = self._build_app()
        self._running = True

        host = self.config.host or "0.0.0.0"
        port = self.config.port or 3000

        logger.info("Starting WebUI on http://{}:{}", host, port)

        config = uvicorn.Config(
            app=app,
            host=host,
            port=port,
            log_level="warning",
            # Disable uvicorn's signal handlers so nanobot's own shutdown works
            # (uvicorn is run inside an existing event loop via server.serve())
        )
        self._server = uvicorn.Server(config)

        # uvicorn.Server.serve() is an async method that runs until shutdown
        await self._server.serve()

    async def stop(self) -> None:
        """Stop the WebUI server and close all WebSocket connections."""
        self._running = False

        # Close all WebSocket connections
        for ws_id, ws in list(self._connections.items()):
            try:
                await ws.close()
            except Exception:
                pass
        self._connections.clear()
        self._session_subs.clear()
        self._ws_session.clear()

        # Signal uvicorn to shut down
        if self._server:
            self._server.should_exit = True
            self._server = None

        logger.info("WebUI channel stopped")

    async def send(self, msg: OutboundMessage) -> None:
        """
        Send an outbound message to the appropriate WebSocket client(s).

        Routes based on chat_id (which is the session_id).
        Supports regular messages, progress updates, and tool hints.
        """
        session_id = msg.chat_id
        ws_ids = self._session_subs.get(session_id, set())

        if not ws_ids:
            logger.debug("No WebSocket connections for session {}, message dropped", session_id)
            return

        # Determine message type from metadata
        is_progress = msg.metadata.get("_progress", False)
        is_tool_hint = msg.metadata.get("_tool_hint", False)
        is_done = msg.metadata.get("_done", True)

        if is_tool_hint:
            payload = {
                "type": "tool_hint",
                "content": msg.content or "",
                "session_id": session_id,
            }
        elif is_progress:
            payload = {
                "type": "progress",
                "content": msg.content or "",
                "session_id": session_id,
            }
        else:
            payload = {
                "type": "message",
                "content": msg.content or "",
                "done": is_done,
                "session_id": session_id,
            }

        # Add media if present
        if msg.media:
            payload["media"] = msg.media

        raw = json.dumps(payload)

        # Send to all WebSocket connections subscribed to this session
        dead_ws_ids = []
        for ws_id in ws_ids:
            ws = self._connections.get(ws_id)
            if ws is None:
                dead_ws_ids.append(ws_id)
                continue
            try:
                await ws.send_text(raw)
            except Exception as e:
                logger.debug("Failed to send to ws {}: {}", ws_id, e)
                dead_ws_ids.append(ws_id)

        # Clean up dead connections
        for ws_id in dead_ws_ids:
            self._cleanup_ws(ws_id)
