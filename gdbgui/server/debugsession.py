import asyncio
import logging
import os
import signal

from starlette.websockets import WebSocket

from .iomanager import IoManager
from .ptylib import Pty

logger = logging.getLogger(__name__)

TERMINATED_GDB_TEARDOWN_TIMEOUT = 2.0  # sec


# TODO:add some alive method?
class DebugSession:
    def __init__(self, gdb_command: str, mi_version: str, socket: WebSocket):

        self.socket = socket
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
        )

        self.mi_version = mi_version
        self.terminating = False
        self.terminated = False

        self.start_readers()

    def terminate(self):
        if self.terminating:
            return
        self.terminating = True
        if self.pygdbmi_controller:
            try:
                self.pygdbmi_controller.write("-gdb-exit\n")
                # force kill terminating gdb if they dont send exit resp
                asyncio.get_running_loop().call_later(
                    TERMINATED_GDB_TEARDOWN_TIMEOUT, self.clean
                )
            except Exception as e:
                logger.error(
                    f"Failed to write '-gdb-exit' to controller {self.pid}: {str(e)}"
                )
                self.clean()

    def clean(self):
        if self.terminated:
            return
        self.terminating = False
        self.terminated = True
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

        loop = asyncio.get_event_loop()
        loop.remove_reader(self.pty_for_debugged_program.stdout)
        loop.remove_reader(self.pty_for_gdb.stdout)
        loop.remove_reader(self.pty_for_gdbgui.stdout)

        if self.pty_for_gdbgui:
            self.pty_for_gdbgui.close()
        if self.pty_for_gdb:
            self.pty_for_gdb.close()
        if self.pty_for_debugged_program:
            self.pty_for_debugged_program.close()

        self.pygdbmi_controller = None
        self.pid = None

    def start_readers(self):
        loop = asyncio.get_event_loop()
        loop.add_reader(
            self.pty_for_debugged_program.stdout,
            self._on_pty_for_debugged_program_readable,
        )
        loop.add_reader(self.pty_for_gdb.stdout, self._on_pty_for_gdb_readable)
        loop.add_reader(self.pty_for_gdbgui.stdout, self._on_pty_for_gdbgui_readable)

    def _on_pty_for_gdbgui_readable(self):
        """A task that runs on a different thread, and emits websocket messages
        of gdb responses"""
        try:
            response = self.pygdbmi_controller.get_gdb_response()

            for resp in response:
                if (
                    resp.get("payload") in ("^exit\r", "^exit")
                    or resp.get("message") == "exit"
                ):
                    self.terminate()

            if response:
                logger.info("emiting 'gdb_response' to socket")
                asyncio.create_task(
                    self.socket.send_json(
                        {"type": "gdb_response", "payload": response}, mode="text"
                    )
                )
        except Exception as e:
            print("Exception while `get_gdb_response`", e)
            response = [
                {
                    "message": None,
                    "type": "console",
                    "payload": "The underlying gdb process has been killed. This tab will no longer function as expected.",
                    "stream": "stderr",
                }
            ]
            asyncio.create_task(
                self.socket.send_json(
                    {"type": "gdb_response", "payload": response}, mode="text"
                )
            )

    def _on_pty_for_debugged_program_readable(self):
        try:
            response = self.pty_for_debugged_program.read()
            if response is not None:
                asyncio.create_task(
                    self.socket.send_json(
                        {"type": "program_pty_response", "payload": response},
                        mode="text",
                    )
                )
        except Exception as e:
            asyncio.create_task(
                self.socket.send_json(
                    {"type": "fatal_server_error", "payload": {"message": str(e)}},
                    mode="text",
                )
            )
            logger.error(e, exc_info=True)

    def _on_pty_for_gdb_readable(self):
        try:
            response = self.pty_for_gdb.read()
            if response is not None:
                asyncio.create_task(
                    self.socket.send_json(
                        {"type": "user_pty_response", "payload": response}, mode="text"
                    )
                )
        except Exception as e:
            asyncio.create_task(
                self.socket.send_json(
                    {"type": "fatal_server_error", "payload": {"message": str(e)}},
                    mode="text",
                )
            )
            logger.error(e, exc_info=True)
