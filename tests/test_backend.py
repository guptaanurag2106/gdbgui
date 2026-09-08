from starlette.testclient import TestClient
from gdbgui.server.app import app

client = TestClient(app)


def test_routes():
    res = client.get("/")
    assert res.status_code == 200


def test_websocket():
    app.state.config = {"gdb_command": "gdb"}
    with client.websocket_connect("/ws") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "debug_session_connection_event"
        assert msg["payload"]["ok"] is True
