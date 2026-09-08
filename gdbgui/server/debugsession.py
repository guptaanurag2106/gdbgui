from typing import Optional
import asyncio
import datetime
import logging
import os
import signal
import time
import traceback

from starlette.websockets import WebSocket, WebSocketState

from .iomanager import IoManager
from .ptylib import Pty

logger = logging.getLogger(__name__)

TERMINATED_GDB_TEARDOWN_TIMEOUT = 2.0  # sec


# TODO:add some alive method?
class DebugSession:
    def __init__(
        self,
        gdb_command: str,
        mi_version: str,
    ):

        self.command = gdb_command
        self.pty_for_debugged_program = Pty()
        self.pty_for_gdbgui = Pty(echo=False)
        gdbgui_startup_cmds = [
            f"new-ui {mi_version} {self.pty_for_gdbgui.name}",
            f"set inferior-tty {self.pty_for_debugged_program.name}",
            "set pagination off",
        ]
        # instead of writing to the pty after it starts, add startup
        # commands to gdb. This allows gdb to be run as sudo and prompt for a
        # password, for example.
        gdbgui_startup_cmds_str = " ".join([f"-iex='{c}'" for c in gdbgui_startup_cmds])
        self.pty_for_gdb = Pty(cmd=f"{gdb_command} {gdbgui_startup_cmds_str}")

        self.pid = self.pty_for_gdb.pid
        # dup fds because in pty both stdin,stdout point to same fd so 'OSError: [Errno 9] Bad file descriptor'
        # manually close pty_for_* so ned 2 dup for when GC closes controller's fd
        self.pygdbmi_controller = IoManager(
            os.fdopen(os.dup(self.pty_for_gdbgui.stdin), mode="wb", buffering=0),  # type: ignore
            os.fdopen(os.dup(self.pty_for_gdbgui.stdout), mode="rb", buffering=0),  # type: ignore
            None,
        )

        self.mi_version = mi_version
        self.start_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.terminating = False
        self.terminate_on: Optional[float] = None
        self.terminated = False

        self.background_task: asyncio.Task = None

    def terminate(self):
        if self.terminating:
            return
        self.terminating = True
        self.terminate_on = time.monotonic() + TERMINATED_GDB_TEARDOWN_TIMEOUT
        if self.pygdbmi_controller:
            try:
                self.pygdbmi_controller.write(
                    "-gdb-exit\n",
                    timeout_sec=0,
                    raise_error_on_timeout=False,
                    read_response=False,
                )
            except Exception as e:
                logger.error(
                    f"Failed to write '-gdb-exit' to controller {self.pid}: {str(e)}"
                )
                self.clean()

    def to_dict(self):
        return {
            "pid": self.pid,
            "start_time": self.start_time,
            "command": self.command,
        }

    def clean(self):
        self.terminating = False
        self.terminated = True
        self.background_task.cancel()
        if self.pid:
            try:
                try:
                    os.kill(-self.pid, signal.SIGKILL)
                except OSError:
                    os.kill(self.pid, signal.SIGKILL)
                os.waitpid(self.pid, 0)
            except Exception as e:
                try:
                    os.waitpid(self.pid, 0)
                except OSError:
                    pass
                logger.error(f"Failed to clean up pid {self.pid}: {str(e)}")

        if self.pty_for_gdbgui:
            self.pty_for_gdbgui.close()
        if self.pty_for_gdb:
            self.pty_for_gdb.close()
        if self.pty_for_debugged_program:
            self.pty_for_debugged_program.close()

        self.pygdbmi_controller = None
        self.pid = None

    async def read_and_forward_gdb_and_pty_output(self, socket: WebSocket):
        """A task that runs on a different thread, and emits websocket messages
        of gdb responses"""
        # TODO:some alive method
        while True:
            await asyncio.sleep(0.05)
            if socket.client_state == WebSocketState.CONNECTING:
                pass
            if self.terminated or socket.client_state == WebSocketState.DISCONNECTED:
                return
            try:
                try:
                    response = self.pygdbmi_controller.get_gdb_response(
                        timeout_sec=0, raise_error_on_timeout=False
                    )

                    for resp in response:
                        if (
                            resp.get("payload") in ("^exit\r", "^exit")
                            or resp.get("message") == "exit"
                        ):
                            self.terminate()

                    if response:
                        logger.info("emiting 'gdb_response' to socket")
                        await socket.send_json(
                            {"type": "gdb_response", "payload": response}, mode="text"
                        )
                except Exception:
                    response = [
                        {
                            "message": None,
                            "type": "console",
                            "payload": "The underlying gdb process has been killed. This tab will no longer function as expected.",
                            "stream": "stderr",
                        }
                    ]
                    await socket.send_json(
                        {"type": "gdb_response", "payload": response}, mode="text"
                    )

            except Exception:
                logger.error("caught exception, continuing:" + traceback.format_exc())

            time_now = time.monotonic()
            # force kill terminating gdb if they dont send exit resp
            if (
                self.terminating
                and self.terminate_on is not None
                and self.terminate_on <= time_now
            ):
                self.clean()

            await self.check_and_forward_pty_output(socket)

    async def check_and_forward_pty_output(self, socket: WebSocket):
        try:
            response = self.pty_for_gdb.read()
            if response is not None:
                await socket.send_json(
                    {"type": "user_pty_response", "payload": response}, mode="text"
                )

            response = self.pty_for_debugged_program.read()
            if response is not None:
                await socket.send_json(
                    {"type": "program_pty_response", "payload": response}, mode="text"
                )
        except Exception as e:
            await socket.send_json(
                {"type": "fatal_server_error", "payload": {"message": str(e)}},
                mode="text",
            )
            self.terminate()
            logger.error(e, exc_info=True)
