Thanks for your interest in contributing to gdbgui!

If your change is small, go ahead and submit a pull request. If it is substantial, create a GitHub issue to discuss it before making the change.

## Dependencies

1. Python >= 3.13
2. Node + [yarn](https://yarnpkg.com/) (for the frontend)
3. gdb (to actually debug programs)

## Setup

Create a venv first, so deps stay isolated:

```
python3 -m venv ~/.venv/gdbgui
source ~/.venv/gdbgui/bin/activate
```

Then install everything:

```
./runner.py install_deps
```

This installs the package in editable mode plus all dev tools (pytest, black, flake8, mypy, mkdocs, ...). Frontend deps install automatically when you run `develop`, `build`, or `test_js`.

## runner.py does everything

It's a simple script with all commands needed for running/building/testing etc. Run it with a command:

```
./runner.py <command>
```

Or run it with no args and type commands at the `>` prompt.

Extra args are passed through, e.g. `./runner.py serve --port=8080`.

## Developing

```
./runner.py develop
```

This installs frontend deps, watches JS files with webpack and python files with watchfiles, and runs the server with reload on Python changes.

Make sure you [turn your cache off](https://www.technipages.com/google-chrome-how-to-completely-disable-cache) so that changes made locally are reflected in the page.

## Tests

Python tests live in `tests/`. JS tests live in `gdbgui/src/js/tests/`.

```
./runner.py test_python   # python tests only
./runner.py test_js       # js tests + production webpack build
./runner.py test          # both
```

## Lint and format

```
./runner.py lint     # tsc, black --check, flake8, mypy, vulture
./runner.py format   # black + prettier
```

## Docs

Docs source is in `docs/`, config in `mkdocs.yml`.

```
./runner.py watch_docs   # live preview
./runner.py build_docs   # build static docs
```

## Publishing a new version

1. Bump the version in `gdbgui/VERSION.txt`.
2. Then verify, in this order:

```
./runner.py build    # clean build + sdist/wheel + twine check
./runner.py serve    # smoke test the built server
./runner.py test     # all tests
./runner.py lint     # all linters
```
