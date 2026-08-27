import os

USING_WINDOWS = os.name == "nt"
if USING_WINDOWS:
    raise RuntimeError(
        "Windows is not supported at this time. "
        + "Versions lower than 0.14.x. are Windows compatible."
    )
import fcntl
import pty
import select
import shlex
import signal
import struct
import termios
from typing import Optional


class Pty:
    max_read_bytes = 1024 * 20

    def __init__(self, *, cmd: Optional[str] = None, echo: bool = True):
        if cmd:
            child_pid, fd = pty.fork()
            if child_pid == 0:
                # this is the child process fork.
                # anything printed here will show up in the pty, including the output
                # of this subprocess
                def sigint_handler(_sig, _frame):
                    # prevent SIGINT (ctrl+c) from exiting
                    # the whole program
                    pass

                signal.signal(signal.SIGINT, sigint_handler)
                args = shlex.split(cmd)
                os.execvp(args[0], args)

            else:
                # this is the parent process fork.
                # store child fd and pid
                self.stdin = fd
                self.stdout = fd
                self.pid = child_pid
        else:
            master, slave = pty.openpty()
            self.stdin = master
            self.stdout = master
            self.slave_fd = slave
            self.name = os.ttyname(slave)
            self.set_echo(echo)

    def close(self):
        for fd_attr in ("stdin", "stdout"):
            fd = getattr(self, fd_attr, None)
            if fd is not None:
                try:
                    os.close(fd)
                except OSError:
                    pass
                setattr(self, fd_attr, None)
        # do slave_fd manually because vulture thinks it is unused
        if hasattr(self, "slave_fd") and self.slave_fd is not None:
            try:
                os.close(self.slave_fd)
            except OSError:
                pass
            self.slave_fd = None

    def set_echo(self, echo_on: bool) -> None:
        iflag, oflag, cflag, lflag, ispeed, ospeed, cc = termios.tcgetattr(self.stdin)
        if echo_on:
            lflag = lflag | termios.ECHO  # type: ignore
        else:
            lflag = lflag & ~termios.ECHO  # type: ignore
        termios.tcsetattr(
            self.stdin,
            termios.TCSANOW,
            [iflag, oflag, cflag, lflag, ispeed, ospeed, cc],
        )

    def set_winsize(self, rows: int, cols: int):
        xpix = 0
        ypix = 0
        winsize = struct.pack("HHHH", rows, cols, xpix, ypix)
        if self.stdin is None:
            raise RuntimeError("fd stdin not assigned")
        fcntl.ioctl(self.stdin, termios.TIOCSWINSZ, winsize)

    def read(self) -> Optional[str]:
        if self.stdout is None:
            return None
        timeout_sec = 0
        data_to_read, _, _ = select.select([self.stdout], [], [], timeout_sec)
        if data_to_read:
            try:
                response = os.read(self.stdout, self.max_read_bytes).decode()
            except (OSError, UnicodeDecodeError):
                return None
            return response
        return None

    def write(self, data: str):
        edata = data.encode()
        os.write(self.stdin, edata)
