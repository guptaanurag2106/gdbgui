#!/usr/bin/env python

import glob
import os

# import to allow gnu readline like keyboard shortcuts
import readline
import shlex
import subprocess
import sys
import threading
from pathlib import Path

custom_env = os.environ.copy()
custom_env["FORCE_COLOR"] = "1"
custom_env["PY_COLORS"] = "1"

files_to_lint = ["gdbgui", "tests"] + [str(p) for p in Path(".").glob("*.py")]
vulture_whitelist = ".vulture_whitelist.py"
files_to_lint.remove(vulture_whitelist)

prettier_command = [
    "npx",
    "prettier@1.19.1",
    "--parser",
    "typescript",
    "--config",
    ".prettierrc.js",
    "gdbgui/src/js/**/*",
]


def help():
    print("install_deps  - install all dev deps")
    print("develop       - dev server with reload")
    print("test_python   - run python tests")
    print("test_js       - run js tests")
    print("test          - run all tests")
    print("lint          - lint")
    print("vulture       - find dead code")
    print("format        - autoformat code")
    print("build         - build dist")
    print("serve         - run server")
    print("install       - install built dist")
    print("watch_docs    - serve docs")
    print("build_docs    - build docs")
    print("quit/exit     - leave")
    print("!cmd          - prefixing command with `!` just runs that command")
    print(
        "extra args are forwarded to the underlying commands e.g. serve --port=8080 runs `python -m gdbgui --port=8080`"
    )
    print("ctrl-c kills running process")


def get_reload_files():
    """returns a list of files that should be watched by the watchfiles
    when in debug mode to trigger a reload of the server
    """
    THIS_DIR = os.path.dirname(os.path.abspath(__file__)) + "/gdbgui"
    dirs = [THIS_DIR]
    extra_files = []
    for extra_dir in dirs:
        for dirname, _, files in os.walk(extra_dir):
            for filename in files:
                filepath = os.path.join(dirname, filename)
                if ".py" in filepath and "pycache" not in filepath:
                    extra_files.append(filepath)
    return extra_files


running: set[subprocess.Popen] = set()


def run_command(command: list[str]) -> bool:
    print(f"Running {' '.join(command)}")
    try:
        process = subprocess.Popen(
            command,
            stdout=sys.stdout,
            stderr=sys.stderr,
            text=True,
            bufsize=1,
            env=custom_env,
        )
        running.add(process)
        try:
            returncode = process.wait()
        except KeyboardInterrupt:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
            return False
        finally:
            running.discard(process)
        if returncode != 0:
            print(f"Exited with code {returncode}")
        return returncode == 0
    except FileNotFoundError as e:
        print(e.strerror, e.filename)
        return False


def test_python(*extra: str) -> bool:
    return run_command(
        [
            "pytest",
            "--cov=gdbgui",
            "--cov-config",
            ".coveragerc",
            "--cov-report=",
            *(extra or ("tests",)),
        ]
    )


def test_js(*extra: str) -> bool:
    # fail on first
    if not run_command(["yarn", "install"]):
        return False
    if not run_command(["yarn", "test", *extra]):
        return False
    if not run_command(["yarn", "build"]):
        return False
    return True


def tests(*extra: str) -> bool:
    # run both
    success = test_python(*extra)
    success &= test_js()
    return success


def format(*extra: str) -> bool:
    success = run_command(["black", "--color", *files_to_lint, *extra])
    success &= run_command([*prettier_command, "--write", *extra])
    return success


# TODO:dead code for ts
def vulture(*extra: str) -> bool:
    return run_command(
        [
            "vulture",
            "--ignore-decorators",
            "@app.*",
            *files_to_lint,
            vulture_whitelist,
            *extra,
        ]
    )


def lint(*extra: str) -> bool:
    if not run_command(["black", "--check", *files_to_lint, *extra]):
        return False
    if not run_command(["flake8", *files_to_lint, *extra]):
        return False
    if not run_command(["mypy", *files_to_lint, *extra]):
        return False
    if not vulture(*extra):
        return False
    # TODO: better ts lint?
    if not run_command([*prettier_command, "--check", *extra]):
        return False
    return True


def develop(*extra: str) -> bool:
    if not run_command(["yarn", "install"]):
        return False
    print("Watching JavaScript file and Python files for changes")
    threading.Thread(
        target=run_command,
        args=(["yarn", "start"],),
        daemon=True,
    ).start()
    cmd = "python -m gdbgui --debug"
    if extra:
        cmd += f" {shlex.join(extra)}"
    if not run_command(["watchfiles", cmd, *get_reload_files()]):
        return False
    return True


def build(*extra: str) -> bool:
    if not run_command(["rm", "-rf", "dist", "build"]):
        return False
    if not run_command(["yarn", "install"]):
        return False
    if not run_command(["yarn", "build"]):
        return False
    if not run_command(["python", "-m", "build", "--sdist", "--wheel", *extra]):
        return False
    if not run_command(["twine", "check", "dist/*"]):
        return False
    return True


def install(*extra: str) -> bool:
    for built_package in glob.glob("dist/*"):
        # ensure we can install the built distributions
        if not run_command(
            ["pip", "install", "--force-reinstall", built_package, *extra]
        ):
            return False
    return True


def install_deps(*extra: str) -> bool:
    return run_command(
        [
            "pip",
            "install",
            "-e",
            ".",
            "mkdocs",
            "mkdocs-material",
            "pytest",
            "pytest-cov",
            "black==26.5.1",
            "vulture",
            "flake8",
            "mypy==1.6.1",
            "check-manifest",
            "build",
            "twine",
            "watchfiles",
            *extra,
        ]
    )


def serve(*extra: str) -> bool:
    return run_command(["python", "-m", "gdbgui", *extra])


def watch_docs(*extra: str) -> bool:
    return run_command(["mkdocs", "serve", *extra])


def build_docs(*extra: str) -> bool:
    return run_command(["mkdocs", "build", *extra])


commands = {
    "install_deps": install_deps,
    "test_python": test_python,
    "test_js": test_js,
    "test": tests,
    "vulture": vulture,
    "format": format,
    "lint": lint,
    "develop": develop,
    "build": build,
    "install": install,
    "serve": serve,
    "watch_docs": watch_docs,
    "build_docs": build_docs,
}


def run_cli(cmd: str, args: list[str]) -> bool:
    if cmd[0] == "!":
        return run_command([cmd[1:], *args])
    if cmd == "help":
        help()
        return True
    if cmd in commands:
        return commands[cmd](*args)
    print(f"Unknown commmand {cmd}, run `help` to see all command")
    return False


if len(sys.argv) > 1:
    sys.exit(0 if run_cli(sys.argv[1], sys.argv[2:]) else 1)

was_last_command_successful = True
print("run `help` to get help")
while True:
    user_input = ""
    try:
        if was_last_command_successful:
            user_input = input("> ")
        else:
            user_input = input("\033[31m>\033[0m ")
    except KeyboardInterrupt:
        if running:
            for p in list(running):
                p.terminate()
            continue
        else:
            break
    except EOFError:
        break
    was_last_command_successful = True
    try:
        parts = shlex.split(user_input)
    except ValueError as e:
        print(f"parse error: {e}")
        was_last_command_successful = False
        continue
    if not parts:
        continue
    cmd, args = parts[0], parts[1:]
    if cmd == "quit" or cmd == "exit":
        break
    else:
        was_last_command_successful = run_cli(cmd, args)
