import json
import logging
import os

from pygments.lexers import get_lexer_for_filename
from starlette.requests import Request
from starlette.responses import JSONResponse, RedirectResponse
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles
from starlette.templating import Jinja2Templates
from typing import cast

from gdbgui import __version__
from .htmllistformatter import HtmlListFormatter

from .constants import (
    TEMPLATE_DIR,
    STATIC_DIR,
    USING_WINDOWS,
    SIGNAL_NAME_TO_OBJ,
    THEMES,
)
from .config import Config

logger = logging.getLogger(__file__)

templates = Jinja2Templates(directory=TEMPLATE_DIR)


async def gdbgui(request: Request):
    """Render the main gdbgui interface"""
    gdb_command = (
        request.query_params["gdb_command"]
        if ("gdb_command" in request.query_params)
        else request.app.state.config["gdb_command"]
    )
    # TODO:reading config twice, once here and once on page load
    config = Config.read()

    initial_data = {
        "gdbgui_version": __version__,
        "gdb_command": gdb_command,
        "initial_binary_and_args": request.app.state.config["initial_binary_and_args"],
        "project_home": request.app.state.config["project_home"],
        "remap_sources": request.app.state.config["remap_sources"],
        "themes": THEMES,
        "signals": SIGNAL_NAME_TO_OBJ,
        "using_windows": USING_WINDOWS,
    }

    return templates.TemplateResponse(
        request,
        "gdbgui.html",
        context={
            "version": __version__,
            "debug": request.app.debug,
            "initial_data": initial_data,
            "theme": config["theme"],
        },
    )


async def help_route(request: Request):
    # TODO: well the help doesn't exist
    return RedirectResponse(
        "https://github.com/guptaanurag2106/gdbgui/blob/master/HELP.md"
    )


async def get_and_edit_config(request: Request):
    """Return or Edit the gdbgui/config.json file"""

    if request.method == "GET":
        return JSONResponse(content=Config.read(), status_code=200)
    elif request.method == "POST":
        req = await request.json()
        success = Config.update_key(req["key"], req["value"])
        if success:
            return JSONResponse(content={"message": "OK"}, status_code=200)
        else:
            return JSONResponse(content={"message": "Failed"}, status_code=500)


# TODO:stream response?
async def read_file(request: Request):
    """Read a file and return its contents as an array"""

    def should_highlight():
        try:
            return json.loads(request.query_params["highlight"])
        except Exception as e:
            if request.app.debug:
                print("Raising exception since debug is on")
                raise e

            else:
                return True  # highlight argument was invalid for some reason, default to true

    path = request.query_params["path"]
    start_line = int(request.query_params["start_line"])
    start_line = max(1, start_line)  # make sure it's not negative
    end_line = int(request.query_params["end_line"])

    # Fix for when you use '~' in paths
    path = os.path.expanduser(path)

    # TODO:can we do this parsing/colouring async?
    if path and os.path.isfile(path):
        try:
            last_modified = os.path.getmtime(path)
            with open(path, "r") as f:
                raw_source_code_list = f.read().split("\n")
                num_lines_in_file = len(raw_source_code_list)
                end_line = min(
                    num_lines_in_file, end_line
                )  # make sure we don't try to go too far

                # if leading lines are '', then the lexer will strip them out, but we want
                # to preserve blank lines. Insert a space whenever we find a blank line.
                for i in range((start_line - 1), (end_line)):
                    if raw_source_code_list[i] == "":
                        raw_source_code_list[i] = " "
                raw_source_code_lines_of_interest = raw_source_code_list[
                    (start_line - 1) : (end_line)
                ]
            try:
                lexer = get_lexer_for_filename(path)
            except Exception:
                lexer = None

            if lexer and should_highlight():
                highlighted = True
                # convert string into tokens
                tokens = lexer.get_tokens("\n".join(raw_source_code_lines_of_interest))
                # format tokens into nice, marked up list of html
                formatter = HtmlListFormatter()  # Don't add newlines after each line
                source_code = formatter.get_marked_up_list(tokens)
            else:
                highlighted = False
                source_code = raw_source_code_lines_of_interest

            return JSONResponse(
                content={
                    "source_code_array": source_code,
                    "path": path,
                    "last_modified_unix_sec": last_modified,
                    "highlighted": highlighted,
                    "start_line": start_line,
                    "end_line": end_line,
                    "num_lines_in_file": num_lines_in_file,
                },
                status_code=200,
            )

        except Exception as e:
            return JSONResponse(content={"message": "%s" % e}, status_code=500)

    else:
        return JSONResponse(
            content={"message": "File not found: %s" % path}, status_code=400
        )


async def get_last_modified_unix_sec(request: Request):
    """Get last modified unix time for a given file"""
    path = request.query_params.get("path")
    path = cast(str, os.path.expanduser(path))
    if path and os.path.isfile(path):
        try:
            last_modified = os.path.getmtime(path)
            return JSONResponse(
                content={"path": path, "last_modified_unix_sec": last_modified},
                status_code=200,
            )

        except Exception as e:
            return JSONResponse(
                content={"message": "%s" % e, "path": path}, status_code=500
            )

    else:
        return JSONResponse(
            content={"message": "File not found: %s" % path, "path": path},
            status_code=400,
        )


async def send_signal_to_pid(request: Request):
    data = await request.json()
    signal_name = data.get("signal_name", "").upper()
    pid_str = str(data.get("pid"))
    try:
        pid_int = int(pid_str)
    except ValueError:
        return JSONResponse(
            content={
                "message": "The pid %s cannot be converted to an integer. Signal %s was not sent."
                % (pid_str, signal_name)
            },
            status_code=400,
        )

    if signal_name not in SIGNAL_NAME_TO_OBJ:
        return JSONResponse(
            content={"message": "No such signal %s" % signal_name},
            status_code=400,
        )
    signal_value = int(SIGNAL_NAME_TO_OBJ[signal_name])

    try:
        os.kill(pid_int, signal_value)
    except Exception:
        return JSONResponse(
            content={
                "message": "Process could not be killed. Is %s an active PID?" % pid_int
            },
            status_code=500,
        )
    return JSONResponse(
        content={
            "message": "sent signal %s (%s) to process id %s"
            % (signal_name, signal_value, pid_str)
        },
        status_code=200,
    )


routes = [
    Route("/", gdbgui, methods=["GET"]),
    Route("/help", help_route, methods=["GET"]),
    Route("/config", get_and_edit_config, methods=["GET", "POST"]),
    Route("/read_file", read_file, methods=["GET"]),
    Route("/get_last_modified_unix_sec", get_last_modified_unix_sec, methods=["GET"]),
    Route("/send_signal_to_pid", send_signal_to_pid, methods=["POST"]),
    Mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static"),
]
