import datetime
import logging
import os
import signal
import time
from collections import defaultdict
from typing import Dict, List, Optional, Set

from pygdbmi.IoManager import IoManager

from .ptylib import Pty

logger = logging.getLogger(__name__)

TERMINATED_GDB_TEARDOWN_TIMEOUT = 2.0  # sec


class DebugSession:
    def __init__(
        self,
        *,
        pygdbmi_controller: IoManager,
        pty_for_gdbgui: Pty,
        pty_for_gdb: Pty,
        pty_for_debugged_program: Pty,
        command: str,
        mi_version: str,
        pid: int,
    ):
        self.command = command
        self.pygdbmi_controller = pygdbmi_controller
        self.pty_for_gdbgui = pty_for_gdbgui
        self.pty_for_gdb = pty_for_gdb
        self.pty_for_debugged_program = pty_for_debugged_program
        self.mi_version = mi_version
        self.pid = pid
        self.start_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.client_ids: Set[str] = set()
        self.terminating = False
        self.terminate_on: Optional[float] = None

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
            "c2": "hi",
            "client_ids": list(self.client_ids),
        }

    def add_client(self, client_id: str):
        self.client_ids.add(client_id)

    def remove_client(self, client_id: str):
        self.client_ids.discard(client_id)
        if len(self.client_ids) == 0:
            self.terminate()

    def clean(self):
        self.terminating = False
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


class SessionManager(object):
    def __init__(self):
        self.debug_session_to_client_ids: Dict[DebugSession, List[str]] = defaultdict(
            list
        )  # key is controller, val is list of client ids

        self.gdb_reader_thread = None

    def connect_client_to_debug_session(
        self, *, desired_gdbpid: int, client_id: str
    ) -> DebugSession:
        debug_session = self.debug_session_from_pid(desired_gdbpid)

        if not debug_session:
            raise ValueError(f"No existing gdb process with pid {desired_gdbpid}")
        debug_session.add_client(client_id)
        self.debug_session_to_client_ids[debug_session].append(client_id)
        return debug_session

    def add_new_debug_session(
        self, *, gdb_command: str, mi_version: str, client_id: str
    ) -> DebugSession:
        pty_for_debugged_program = Pty()
        pty_for_gdbgui = Pty(echo=False)
        gdbgui_startup_cmds = [
            f"new-ui {mi_version} {pty_for_gdbgui.name}",
            f"set inferior-tty {pty_for_debugged_program.name}",
            "set pagination off",
        ]
        # instead of writing to the pty after it starts, add startup
        # commands to gdb. This allows gdb to be run as sudo and prompt for a
        # password, for example.
        gdbgui_startup_cmds_str = " ".join([f"-iex='{c}'" for c in gdbgui_startup_cmds])
        pty_for_gdb = Pty(cmd=f"{gdb_command} {gdbgui_startup_cmds_str}")

        pid = pty_for_gdb.pid
        debug_session = DebugSession(
            # dup fds because in pty both stdin,stdout point to same fd so 'OSError: [Errno 9] Bad file descriptor'
            # manually close pty_for_* so ned 2 dup for when GC closes controller's fd
            pygdbmi_controller=IoManager(
                os.fdopen(os.dup(pty_for_gdbgui.stdin), mode="wb", buffering=0),  # type: ignore
                os.fdopen(os.dup(pty_for_gdbgui.stdout), mode="rb", buffering=0),  # type: ignore
                None,
            ),
            pty_for_gdbgui=pty_for_gdbgui,
            pty_for_gdb=pty_for_gdb,
            pty_for_debugged_program=pty_for_debugged_program,
            command=gdb_command,
            mi_version=mi_version,
            pid=pid,
        )
        debug_session.add_client(client_id)
        self.debug_session_to_client_ids[debug_session] = [client_id]
        return debug_session

    def remove_debug_session_by_pid(self, gdbpid: int) -> List[str]:
        debug_session = self.debug_session_from_pid(gdbpid)
        if debug_session:
            orphaned_client_ids = self.remove_debug_session(debug_session)
        else:
            logger.info(f"could not find debug session with gdb pid {gdbpid}")
            orphaned_client_ids = []
        return orphaned_client_ids

    def remove_debug_session(self, debug_session: DebugSession) -> List[str]:
        pid = debug_session.pid
        debug_session.terminate()
        if debug_session.pid is None and debug_session.pygdbmi_controller is None:
            logger.info(f"Removing debug session for pid {pid}")
            orphaned_client_ids = self.debug_session_to_client_ids.pop(
                debug_session, []
            )
        else:
            # graceful shutdown in progress; the poll loop will finish the
            # cleanup and remove this session from the registry
            orphaned_client_ids = self.debug_session_to_client_ids.get(
                debug_session, []
            )
        return orphaned_client_ids

    def get_pid_from_debug_session(self, debug_session: DebugSession) -> Optional[int]:
        if debug_session and debug_session.pid:
            return debug_session.pid
        return None

    def debug_session_from_pid(self, pid: int) -> Optional[DebugSession]:
        for debug_session in self.debug_session_to_client_ids:
            this_pid = self.get_pid_from_debug_session(debug_session)
            if this_pid == pid:
                return debug_session
        return None

    def debug_session_from_client_id(self, client_id: str) -> Optional[DebugSession]:
        for debug_session, client_ids in self.debug_session_to_client_ids.items():
            if client_id in client_ids:
                return debug_session
        return None

    def get_dashboard_data(self) -> List[DebugSession]:
        return [
            debug_session.to_dict()
            for debug_session in self.debug_session_to_client_ids.keys()
        ]

    def disconnect_client(self, client_id: str):
        for debug_session, client_ids in self.debug_session_to_client_ids.items():
            if client_id in client_ids:
                client_ids.remove(client_id)
                debug_session.remove_client(client_id)
