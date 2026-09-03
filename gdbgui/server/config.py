import copy
import json
import os
from pathlib import Path
import shutil
from typing import Any
from .constants import THEMES
import tempfile


class Config:
    def __init__(self):
        raise Exception("initializing static class Config")

    DEFAULT_CONFIG: dict[str, Any] = {
        "theme": "monokai",
        "max_lines_of_code_to_fetch": 500,
        "auto_add_breakpoint_to_main": True,
        "pretty_print": True,
        "refresh_state_after_sending_console_command": True,
        "show_all_sent_commands_in_console": True,
        "highlight_source_code": True,
        "middle_sizes": [20, 45, 35],
        "show_filesystem": True,
        "past_binaries": [],
    }
    CONFIG_KEYS = DEFAULT_CONFIG.keys()

    assert len(CONFIG_KEYS) == 10, "Number of config keys has changed"

    _config: dict[str, Any]
    CONFIG_FILE_PATH: Path = (
        Path(os.getenv("XDG_CONFIG_HOME", "~/.config")).expanduser()
        / "gdbgui"
        / "config.json"
    )

    @staticmethod
    def save_config():
        Config.CONFIG_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(
            mode="w", dir=Config.CONFIG_FILE_PATH.parent, delete=False
        ) as tmp:
            tmp.write(json.dumps(Config._config, indent=4))
            tmp.flush()
            os.fsync(tmp.fileno())
        shutil.move(tmp.name, Config.CONFIG_FILE_PATH)

    @staticmethod
    def create_new():
        # create config file with defaults
        Config._config = copy.deepcopy(Config.DEFAULT_CONFIG)
        Config.save_config()

    @staticmethod
    def reread_if_needed():
        # TODO:maybe not read if not changed, though file size is small?
        try:
            config_file_path_content = Config.CONFIG_FILE_PATH.read_text(
                encoding="utf-8"
            )
            config = json.loads(config_file_path_content)
            Config._config = copy.deepcopy(Config.DEFAULT_CONFIG)
            for key, value in config.items():
                Config._update_key(key, value)
        except FileNotFoundError:
            print("Config file not found")
            Config.create_new()
        except json.decoder.JSONDecodeError as e:
            print("Config file is not a valid json, overwriting ", e)
            Config.create_new()
        except Exception as e:  # permission etc
            print("Could not read/decode config file ", Config.CONFIG_FILE_PATH, e)
            Config.create_new()

    @staticmethod
    def read() -> dict[str, Any]:
        Config.reread_if_needed()
        return Config._config

    @staticmethod
    def _update_key(key: str, value: Any) -> bool:
        success = False
        match key:
            case "theme":
                if value in THEMES:
                    Config._config[key] = value
                    success = True
            case "max_lines_of_code_to_fetch":
                if type(value) is int and value > 0:
                    Config._config[key] = value
                    success = True
            case "auto_add_breakpoint_to_main":
                if type(value) is bool:
                    Config._config[key] = value
                    success = True
            case "pretty_print":
                if type(value) is bool:
                    Config._config[key] = value
                    success = True
            case "refresh_state_after_sending_console_command":
                if type(value) is bool:
                    Config._config[key] = value
                    success = True
            case "show_all_sent_commands_in_console":
                if type(value) is bool:
                    Config._config[key] = value
                    success = True
            case "highlight_source_code":
                if type(value) is bool:
                    Config._config[key] = value
                    success = True
            case "middle_sizes":
                if type(value) is list and len(value) == 3 and 95 < sum(value) <= 101:
                    Config._config[key] = value
                    success = True
            case "show_filesystem":
                if type(value) is bool:
                    Config._config[key] = value
                    success = True
            case "past_binaries":
                if type(value) is list:
                    Config._config[key] = value
                    success = True
            case _:
                print(f"ERROR: unknown key `{key}` with value `{value}` in update_key")
                return False

        if not success:
            print(f"ERROR: incompatible value `{value}` for key `{key}` in update_key")
        return success

    @staticmethod
    def update_key(key: str, value: Any) -> bool:
        Config.reread_if_needed()
        if Config._update_key(key, value):
            Config.save_config()
            return True

        return False
