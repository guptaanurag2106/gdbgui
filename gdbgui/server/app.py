import asyncio
import json
import logging
import traceback

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import Response
from starlette.routing import WebSocketRoute
from starlette.types import ASGIApp, Receive, Scope, Send
from starlette.websockets import WebSocket, WebSocketDisconnect

from .constants import DEFAULT_GDB_EXECUTABLE
from .debugsession import DebugSession
from .http_routes import routes

logger = logging.getLogger(__file__)

app = Starlette(routes=routes)
# we need to ensure only one client is connected, since each client will have a socket we can
# ensure that there is only 1 active socket
app.state.socket = None  # current connected socket
app.state.single_user_lock = asyncio.Lock()


class CrossOriginCheckMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """Compare headers HOST and ORIGIN. Remove protocol prefix from ORIGIN, then
        compare. Return true if they are not equal
        example HTTP_HOST: '127.0.0.1:5000'
        example HTTP_ORIGIN: 'http://127.0.0.1:5000'
        """
        if scope["type"] == "http":
            request = Request(scope, receive)
            origin = request.headers.get("origin")
            host = request.headers.get("host")
            if origin is None:
                # origin is sometimes omitted by the browser when origin and host are equal
                await self.app(scope, receive, send)
                return

            if origin.startswith("http://"):
                origin = origin.replace("http://", "")
            elif origin.startswith("https://"):
                origin = origin.replace("https://", "")
            if host != origin:
                response = Response("Forbidden", status_code=403)
                await response(scope, receive, send)
                return

        elif scope["type"] == "websocket":
            socket = WebSocket(scope, receive, send)
            origin = socket.headers.get("origin")
            host = socket.headers.get("host")
            if origin is None:
                # origin is sometimes omitted by the browser when origin and host are equal
                await self.app(scope, receive, send)
                return

            if origin.startswith("http://"):
                origin = origin.replace("http://", "")
            elif origin.startswith("https://"):
                origin = origin.replace("https://", "")

            if host != origin:
                await send({"type": "websocket.close", "code": 4401})
                return

        await self.app(scope, receive, send)


app.add_middleware(CrossOriginCheckMiddleware)


async def socket(socket: WebSocket):
    if socket.app.state.socket is not None:
        await socket.close(reason="existing_connection")
        return

    await socket.accept()

    print("connected")
    logger.info("socket connected")
    try:
        gdb_command = socket.app.state.config.get("gdb_command", DEFAULT_GDB_EXECUTABLE)
        mi_version = socket.app.state.config.get("mi_version", "mi2")
        debug_session = DebugSession(gdb_command=gdb_command, mi_version=mi_version)
        await socket.send_json(
            {
                "type": "debug_session_connection_event",
                "payload": {
                    "ok": True,
                    "started_new_gdb_process": True,
                    "message": f"Started new gdb process, pid {debug_session.pid}",
                    "pid": debug_session.pid,
                },
            },
            mode="text",
        )
        debug_session.background_task = asyncio.create_task(
            debug_session.read_and_forward_gdb_and_pty_output(socket)
        )
    except Exception as e:
        await socket.send_json(
            {
                "type": "debug_session_connection_event",
                "payload": {
                    "message": f"Failed to establish gdb session: {e}",
                    "ok": False,
                },
            },
            mode="text",
        )
        print(e)
        await socket.close(reason=f"failed to create debug session {e}")

    async with socket.app.state.single_user_lock:
        socket.app.state.socket = socket
        socket.app.state.debug_session = debug_session

    logger.info("Created background thread to read gdb responses")
    try:
        while True:
            try:
                message = await socket.receive_json(mode="text")
                match message["type"]:
                    case "pty_interaction":
                        """Write a character to the user facing pty"""
                        if not debug_session or debug_session.terminated:
                            await socket.send_json(
                                {
                                    "type": "error_running_gdb_command",
                                    "payload": {"message": "no gdb session available"},
                                },
                                mode="text",
                            )
                            await socket.close(reason="no gdb session available")
                            async with socket.app.state.single_user_lock:
                                socket.app.state.socket = None
                                socket.app.state.debug_session = None
                            return

                        try:
                            payload = message["payload"]
                            pty_name = payload["pty_name"]
                            if pty_name == "user_pty":
                                pty = debug_session.pty_for_gdb
                            elif pty_name == "program_pty":
                                pty = debug_session.pty_for_debugged_program
                            else:
                                raise ValueError(f"Unknown pty: {pty_name}")

                            action = payload["action"]
                            if action == "write":
                                key = payload["key"]
                                pty.write(key)
                            elif action == "set_winsize":
                                pty.set_winsize(payload["rows"], payload["cols"])
                            else:
                                raise ValueError(f"Unknown action {action}")
                        except Exception:
                            err = traceback.format_exc()
                            logger.error(err)
                            await socket.send_json(
                                {
                                    "type": "error_running_gdb_command",
                                    "payload": {"message": err},
                                },
                                mode="text",
                            )
                    case "run_gdb_command":
                        """Write commands to gdbgui's gdb mi pty"""
                        if not debug_session:
                            await socket.send_json(
                                {
                                    "type": "error_running_gdb_command",
                                    "payload": {"message": "no gdb session available"},
                                },
                                mode="text",
                            )
                        pty_mi = debug_session.pygdbmi_controller
                        if pty_mi is not None:
                            try:
                                # the command (string) or commands (list) to run
                                cmds = message["payload"]["cmd"]
                                for cmd in cmds:
                                    pty_mi.write(
                                        cmd + "\n",
                                        timeout_sec=0,
                                        raise_error_on_timeout=False,
                                        read_response=False,
                                    )

                            except Exception:
                                err = traceback.format_exc()
                                logger.error(err)
                                await socket.send_json(
                                    {
                                        "type": "error_running_gdb_command",
                                        "payload": {"message": err},
                                    },
                                    mode="text",
                                )
                        else:
                            await socket.send_json(
                                {
                                    "type": "error_running_gdb_command",
                                    "payload": {"message": "gdb is not running"},
                                },
                                mode="text",
                            )
                    case _:
                        await socket.send_json(
                            {
                                "type": "server_error",
                                "payload": {
                                    "message": f"server receieved unknown message type {message['type']}"
                                },
                            },
                            mode="text",
                        )
                        continue

            except json.JSONDecodeError as e:
                logger.error(f"Cannot decode websocket message {message}: {e}")
                await socket.send_json(
                    {
                        "type": "server_error",
                        "payload": {"message": "server received malformed data"},
                    },
                    mode="text",
                )

    except WebSocketDisconnect:
        """do nothing if client disconnects"""
        async with socket.app.state.single_user_lock:
            socket.app.state.socket = None
            socket.app.state.debug_session = None
        debug_session.terminate()
        logger.info("Client websocket disconnected")


app.router.routes.append(WebSocketRoute("/ws", socket))
