import os
from pathlib import Path
import subprocess
from sys import platform

import hashlib
import nox  # type: ignore
import glob

nox.options.reuse_existing_virtualenvs = True
nox.options.sessions = ["tests", "lint", "docs"]
python_version = ["3.14"]

prettier_command = [
    "npx",
    "prettier@1.19.1",
    "--parser",
    "typescript",
    "--config",
    ".prettierrc.js",
    "gdbgui/src/js/**/*",
]

doc_dependencies = [".", "mkdocs", "mkdocs-material"]
lint_dependencies = [
    "black==26.5.1",
    "vulture",
    "flake8",
    "mypy==1.6.1",
    "check-manifest",
]
vulture_whitelist = ".vulture_whitelist.py"
files_to_lint = ["gdbgui", "tests"] + [str(p) for p in Path(".").glob("*.py")]
files_to_lint.remove(vulture_whitelist)
publish_deps = ["build", "twine"]


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


@nox.session(reuse_venv=True)
def python_tests(session):
    session.install("-e", ".")
    session.install(".", "pytest", "pytest-cov")
    tests = session.posargs or ["tests"]
    session.run(
        "pytest", "--cov=gdbgui", "--cov-config", ".coveragerc", "--cov-report=", *tests
    )
    session.notify("cover")


@nox.session(reuse_venv=True)
def js_tests(session):
    session.run("yarn", "install", external=True)
    session.run("yarn", "test", external=True)
    session.run("yarn", "build", external=True)


@nox.session(reuse_venv=True, python=python_version)
def tests(session):
    python_tests(session)
    js_tests(session)


@nox.session(reuse_venv=True)
def cover(session):
    """Coverage analysis"""
    session.install("coverage")
    session.run(
        "coverage",
        "report",
        "--show-missing",
        "--omit=gdbgui/SSLify.py",
        "--fail-under=20",
    )
    session.run("coverage", "erase")


@nox.session()
def vulture(session):
    """Find dead code"""
    session.install("vulture")
    session.run(
        "vulture",
        "--ignore-decorators",
        "@app.*,@nox.*,@blueprint.*",
        *files_to_lint,
        vulture_whitelist,
        *session.posargs,
    )


@nox.session()
def lint(session):
    session.install(".", *lint_dependencies)
    session.run("black", "--check", *files_to_lint)
    session.run("flake8", *files_to_lint)
    session.run("mypy", *files_to_lint)
    vulture(session)
    session.run(*prettier_command, "--check", external=True)


@nox.session(reuse_venv=True)
def autoformat(session):
    session.install(*lint_dependencies)
    session.run("black", *files_to_lint)
    session.run(*prettier_command, "--write", external=True)


@nox.session(reuse_venv=True)
def docs(session):
    session.install(*doc_dependencies)
    session.run("mkdocs", "build")


@nox.session(reuse_venv=True)
def develop(session):
    session.install("-e", ".")
    session.install("watchfiles")
    session.run("yarn", "install", external=True)
    print("Watching JavaScript file and Python files for changes")
    with subprocess.Popen(["yarn", "start"]):
        session.run("watchfiles", "python -m gdbgui --debug", *get_reload_files())
        # session.run("python", "-m", "gdbgui", "--debug")


@nox.session(reuse_venv=True)
def serve(session):
    session.install("-e", ".")
    session.run("python", "-m", "gdbgui", *session.posargs)


@nox.session(reuse_venv=True)
def build(session):
    """Build python distribution (sdist and wheels)"""
    session.install(*publish_deps)
    autoformat(session)
    # lint(session)
    # tests(session)
    session.run("rm", "-rf", "dist", "build", external=True)
    session.run("yarn", external=True)
    session.run("yarn", "build", external=True)
    session.run("python", "-m", "build", "--sdist", "--wheel")
    session.run("twine", "check", "dist/*")
    for built_package in glob.glob("dist/*"):
        # ensure we can install the built distributions
        session.run("pip", "install", "--force-reinstall", built_package)


@nox.session(reuse_venv=True)
def publish(session):
    session.install(*publish_deps)
    build(session)
    print("REMINDER: Has the changelog been updated?")
    session.run("python", "-m", "twine", "upload", "dist/*")
    publish_docs(session)


@nox.session(reuse_venv=True)
def watch_docs(session):
    session.install(*doc_dependencies)
    session.run("mkdocs", "serve")


@nox.session(reuse_venv=True)
def publish_docs(session):
    session.install(*doc_dependencies)
    session.run("mkdocs", "gh-deploy")


@nox.session(reuse_venv=True, python=python_version)
def build_executables_current_platform(session):
    session.run("yarn", "install", external=True)
    session.run("yarn", "build", external=True)
    session.install(".", "PyInstaller==6.14")
    session.run("python", "make_executable.py")
    session.notify("build_pex")


@nox.session(reuse_venv=True)
def build_executables_mac(session):
    if not platform.startswith("darwin"):
        raise Exception(f"Unexpected platform {platform}")
    session.notify("build_executables_current_platform")


@nox.session(reuse_venv=True)
def build_executables_linux(session):
    if not platform.startswith("linux"):
        raise Exception(f"Unexpected platform {platform}")
    session.notify("build_executables_current_platform")


@nox.session(reuse_venv=True)
def build_executable_windows(session):
    if not platform.startswith("win32"):
        raise Exception(f"Unexpected platform {platform}")
    session.notify("build_executables_current_platform")


@nox.session
def build_pex(session):
    """Builds a pex of gdbgui"""
    # NOTE: frontend must be built before running this
    session.install("pex")
    pex_path = Path("build/executable/gdbgui.pex")
    session.run(
        "pex",
        ".",
        "--console-script",
        "gdbgui",
        "--output-file",
        str(pex_path),
        "--sh-boot",
        "--validate-entry-point",
        external=True,
    )
    checksum = hashlib.md5(pex_path.read_bytes()).hexdigest()
    with open(f"{pex_path}.md5", "w+") as f:
        f.write(checksum + "\n")
