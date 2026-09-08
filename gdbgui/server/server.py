import socket
import threading
import time
import uvicorn
import webbrowser
from typing import Any

from .constants import DEFAULT_HOST, DEFAULT_PORT, colorize
from .app import app


def wait_and_open_browser(browsername, url, host, port):
    # to not just race against flask starting we can try to connect to the host,port
    # with small sleep until it connects
    while True:
        try:
            with socket.create_connection((host, port), timeout=0.1):
                break
        except OSError:
            time.sleep(0.02)
    b = webbrowser.get(browsername) if browsername else webbrowser
    b.open_new_tab(url)


def run_server(
    config: dict[str, Any],
    host=DEFAULT_HOST,
    port=DEFAULT_PORT,
    debug=False,
    open_browser=True,
    browsername=None,
):
    """Run the server of the gdbgui"""

    url = "%s:%s" % (host, port)
    protocol = "http://"
    url_with_prefix = "http://" + url

    try:
        url = (socket.gethostbyname(socket.gethostname()), port)
    except Exception:
        url = (host, port)

    if open_browser is True and debug is False:
        browsertext = repr(browsername) if browsername else "default browser"
        args = (browsertext,) + url
        text = ("Opening gdbgui with %s at " + protocol + "%s:%d") % args
        print(colorize(text))
        threading.Thread(
            target=wait_and_open_browser,
            args=(browsername, url_with_prefix, host, port),
            daemon=True,
        ).start()
    else:
        print(colorize(f"View gdbgui at {protocol}{url[0]}:{url[1]}"))

    print("exit gdbgui by pressing CTRL+C")
    try:
        # TODO: see other run options
        app.debug = debug
        app.state.config = config
        uvicorn.run(
            app,
            host=host,
            port=int(port),
            log_level="debug" if debug else "warning",
        )
    except KeyboardInterrupt:
        # Process was interrupted by ctrl+c on keyboard, show message
        pass
