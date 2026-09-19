from starlette.testclient import TestClient
from gdbgui.server.app import app

client = TestClient(app)


def test_routes():
    app.state.config = {
        "gdb_command": "gdb",
        "initial_binary_and_args": "",
        "project_home": "",
        "remap_sources": "",
    }
    res = client.get("/")
    assert res.status_code == 200


def test_websocket():
    app.state.config = {
        "gdb_command": "gdb",
        "initial_binary_and_args": "",
        "project_home": "",
        "remap_sources": "",
    }
    with client.websocket_connect("/ws") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "debug_session_connection_event"
        assert msg["payload"]["ok"] is True
