"""This module defines the `IoManager` class
which manages I/O for file objects connected to an existing gdb process
or pty.
"""

import errno
import logging
import os
from pprint import pformat
from typing import IO, Any, Dict, List, Optional, Tuple
from .gdbmiparser import parse_response, response_is_finished

USING_WINDOWS = os.name == "nt"


if USING_WINDOWS:
    import msvcrt
    from ctypes import POINTER, WinError, byref, windll, wintypes  # type: ignore
    from ctypes.wintypes import BOOL, DWORD, HANDLE
else:
    import fcntl


__all__ = ["IoManager"]


logger = logging.getLogger(__name__)


# Trimmed down version of https://github.com/cs01/pygdbmi specifically for this application
class IoManager:
    def __init__(self, stdin: IO[bytes], stdout: IO[bytes]) -> None:
        """
        Manage I/O for file objects created before calling this class
        This can be useful if the gdb process is managed elsewhere, or if a
        pty is used.
        """

        if stdout is None or stdin is None:
            raise Exception("stdout and stdin cannot be None")

        self.stdin = stdin
        self.stdout = stdout

        self.stdin_fileno = self.stdin.fileno()
        self.stdout_fileno = self.stdout.fileno()

        self._incomplete_stdout_output: Any = None
        _make_non_blocking(self.stdout)

    def get_gdb_response(
        self,
    ) -> List[Dict]:
        """
         Get GDB response, since this is called from asyncio add_reader, there is data available on stdout
        so no need to select on the fds

         Args:

         Returns:
             List of parsed GDB responses, returned from gdbmiparser.parse_response, with the
             additional key 'stream' which is 'stdout'
        """

        if USING_WINDOWS:
            return self._get_responses_windows()
        else:
            return self._get_responses_unix()

    def _get_responses_windows(self) -> List[Dict]:
        """Get responses on windows. Assume no support for select and use a while loop."""
        try:
            raw_output = self.stdout.readline().replace(b"\r", b"\n")
            return self._get_responses_list(raw_output)
        except OSError:
            return []

    def _get_responses_unix(self) -> List[Dict]:
        """Get responses on unix-like system"""
        try:
            raw_output = self.stdout.read()
            if not raw_output:
                return []
            return self._get_responses_list(raw_output)
        except OSError as e:
            if e.errno == errno.EIO:
                # TODO:find something better to do
                return []
            elif e.errno in (errno.EAGAIN, errno.EWOULDBLOCK):
                return []
            raise

    def _get_responses_list(self, raw_output: bytes) -> List[Dict[Any, Any]]:
        """Get parsed response list from string output
        Args:
            raw_output (unicode): gdb output to parse
            stream (str): either stdout or stderr
        """
        responses: List[Dict[Any, Any]] = []

        _new_output, self._incomplete_stdout_output = _buffer_incomplete_responses(
            raw_output, self._incomplete_stdout_output
        )

        if not _new_output:
            return responses

        response_list = list(
            filter(lambda x: x, _new_output.decode(errors="replace").split("\n"))
        )  # remove blank lines

        # parse each response from gdb into a dict, and store in a list
        for response in response_list:
            if response_is_finished(response):
                pass
            else:
                parsed_response = parse_response(response)

                logger.debug("%s", pformat(parsed_response))

                responses.append(parsed_response)

        return responses

    def write(self, mi_cmd_to_write: str):
        """Write to gdb process. Block while parsing responses from gdb for a maximum of timeout_sec.

        Args:
            mi_cmd_to_write: String to write to gdb.
        Returns:
            List of parsed gdb responses if read_response is True, otherwise []
        """
        # self.verify_valid_gdb_subprocess()

        # Ensure proper type of the mi command
        logger.debug("writing: %s", mi_cmd_to_write)

        mi_cmd_to_write_nl = mi_cmd_to_write + "\n"

        self.stdin.write(mi_cmd_to_write_nl.encode())  # type: ignore
        # must flush, otherwise gdb won't realize there is data
        # to evaluate, and we won't get a response
        self.stdin.flush()  # type: ignore


def _buffer_incomplete_responses(
    raw_output: Optional[bytes], buf: Optional[bytes]
) -> Tuple[Optional[bytes], Optional[bytes]]:
    """It is possible for some of gdb's output to be read before it completely finished its response.
    In that case, a partial mi response was read, which cannot be parsed into structured data.
    We want to ALWAYS parse complete mi records. To do this, we store a buffer of gdb's
    output if the output did not end in a newline.

    Args:
        raw_output: Contents of the gdb mi output
        buf (str): Buffered gdb response from the past. This is incomplete and needs to be prepended to
        gdb's next output.

    Returns:
        (raw_output, buf)
    """

    if raw_output:
        if buf:
            # concatenate buffer and new output
            raw_output = b"".join([buf, raw_output])
            buf = None

        if b"\n" not in raw_output:
            # newline was not found, so assume output is incomplete and store in buffer
            buf = raw_output
            raw_output = None

        elif not raw_output.endswith(b"\n"):
            # raw output doesn't end in a newline, so store everything after the last newline (if anything)
            # in the buffer, and parse everything before it
            remainder_offset = raw_output.rindex(b"\n") + 1
            buf = raw_output[remainder_offset:]
            raw_output = raw_output[:remainder_offset]

    return (raw_output, buf)


def _make_non_blocking(file_obj: IO) -> None:
    """make file object non-blocking
    Windows doesn't have the fcntl module, but someone on
    stack overflow supplied this code as an answer, and it works
    http://stackoverflow.com/a/34504971/2893090"""

    if USING_WINDOWS:
        LPDWORD = POINTER(DWORD)
        PIPE_NOWAIT = wintypes.DWORD(0x00000001)

        SetNamedPipeHandleState = windll.kernel32.SetNamedPipeHandleState
        SetNamedPipeHandleState.argtypes = [HANDLE, LPDWORD, LPDWORD, LPDWORD]
        SetNamedPipeHandleState.restype = BOOL

        h = msvcrt.get_osfhandle(file_obj.fileno())  # type: ignore

        res = windll.kernel32.SetNamedPipeHandleState(h, byref(PIPE_NOWAIT), None, None)
        if res == 0:
            raise ValueError(WinError())

    else:
        # Set the file status flag (F_SETFL) on the pipes to be non-blocking
        # so we can attempt to read from a pipe with no new data without locking
        # the program up
        fcntl.fcntl(file_obj, fcntl.F_SETFL, os.O_NONBLOCK)
