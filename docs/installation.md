# gdbgui installation

gdbgui is distributed as a Python wheel and source archive in the
[Github Releases](https://github.com/guptaanurag2106/gdbgui/releases).

## Install a released wheel

Download the `gdbgui-<version>-py3-none-any.whl` file from a release. For an
isolated command-line installation, use [pipx](https://pipx.pypa.io/):

```bash
pipx install ./gdbgui-0.16.0.0-py3-none-any.whl
```

You can also install it in an existing virtual environment:

```bash
python -m pip install ./gdbgui-0.16.0.0-py3-none-any.whl
```

Run gdbgui with:

```bash
gdbgui
```

Use `gdbgui --help` to see the available options. To remove the pipx
installation, run `pipx uninstall gdbgui`.

## Install from source

Source installation is for users who want to run with latest changes (which might
have bugs) instead of the released version. This requires python 3.13 or newer,
Node.js, yarn.

Clone the repository and build the frontend bundle:

```bash
git clone https://github.com/guptaanurag2106/gdbgui.git
cd gdbgui
yarn install --frozen-lockfile
yarn build
```

Then install the checkout with pipx:

```bash
pipx install .
```

To upgrade (after pulling newer changes) or uninstall:

```bash
pipx upgrade .
pipx uninstall .
```

For a normal virtual environment, use `python -m pip install .` instead.

The repository also includes `runner.py` for development tasks such as tests,
linting, documentation, and distribution builds. Run `python runner.py help`
for the available commands.

## System dependencies

- gdb (GNU debugger)
- Python 3.13 or newer

### Linux

```bash
sudo apt install gdb python3
```

### macOS

```bash
brew install python3
brew install gdb
```

macOS users may also need to codesign gdb. See the
[gdb codesigning instructions](http://andresabino.com/2015/04/14/codesign-gdb-on-mac-os-x-yosemite-10-10-2/)
if gdb reports:
`please check gdb is codesigned - see taskgated(8)`.

### Windows

gdbgui does not support Windows at the moment.
