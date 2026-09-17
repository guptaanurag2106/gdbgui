import React from "react";
import { store } from "statorgfc";
import constants from "./constants";
import Actions from "./Actions";
import Util from "./Util";
import ToolTipTourguide from "./ToolTipTourguide";
import CompletionDropdown from "./CompletionDropdown";
import { update_config_key } from "./Config";
import { ChevronDown } from "lucide-react";

const TARGET_TYPES = {
    file: "file",
    server: "server",
    process: "process",
    //TODO:what is this target type
    target_download: "target_download",
};

interface BinaryLoaderState {
    past_binaries: string[];
    user_input: string;
    initial_set_target_app: boolean;
    target_type: (typeof TARGET_TYPES)[keyof typeof TARGET_TYPES];
    dropdown_open: boolean;
}

/**
 * The BinaryLoader component allows the user to select their binary
 * and specify inputs
 */
interface BinaryLoaderProps {
    initial_binary_and_args: string[];
}
//TODO:allow to set project_home and gdb-cmd here only
class BinaryLoader extends React.Component<
    BinaryLoaderProps,
    BinaryLoaderState
> {
    dropdownRef = React.createRef<HTMLDivElement>();
    constructor(props: BinaryLoaderProps) {
        super(props);

        const past_binaries = [...new Set<string>(store.get("past_binaries"))];

        let user_input = props.initial_binary_and_args.join(" ");
        if (!user_input) {
            user_input = past_binaries[0];
        }

        this.state = {
            past_binaries: past_binaries,
            user_input: user_input,
            // initial_set_target_app: props.initial_binary_and_args.length, // if user supplied initial binary, load it immediately
            initial_set_target_app: user_input.length > 0, // if user supplied initial binary, load it immediately
            target_type: TARGET_TYPES.file,
            dropdown_open: false,
        };
    }
    componentDidMount() {
        document.addEventListener("mousedown", this._handle_click_outside);
        if (this.state.initial_set_target_app) {
            this.setState({ initial_set_target_app: false });
            this.set_target_app();
        }
    }
    componentWillUnmount() {
        document.removeEventListener("mousedown", this._handle_click_outside);
    }
    _handle_click_outside = (e: MouseEvent) => {
        if (
            this.state.dropdown_open &&
            this.dropdownRef.current &&
            !this.dropdownRef.current.contains(e.target as Node)
        ) {
            this.setState({ dropdown_open: false });
        }
    };
    set_target_app() {
        let user_input = (this.state.user_input || "").trim();

        if (user_input === "") {
            Actions.add_console_entries(
                "input cannot be empty",
                constants.console_entry_type.GDBGUI_OUTPUT,
            );
            return;
        }

        this._add_user_input_to_history(user_input);

        if (this.state.target_type === TARGET_TYPES.file) {
            const { binary, args } =
                this._parse_binary_and_args_from_user_input(user_input);
            Actions.set_gdb_binary_and_arguments(binary, args);
        } else if (this.state.target_type === TARGET_TYPES.server) {
            Actions.connect_to_gdbserver(user_input);
        } else if (this.state.target_type === TARGET_TYPES.process) {
            Actions.attach_to_process(user_input);
        }
        Actions.get_target_features();
    }
    onchange_user_input(text: string) {
        if (initial_data.using_windows) {
            // replace backslashes with forward slashes when using windows
            this.setState({ user_input: text.replace(/\\/g, "/") });
        } else {
            this.setState({ user_input: text });
        }
    }
    onselect_user_input(text: string) {
        this.setState({ user_input: text });
    }
    _add_user_input_to_history(binary_and_args: any) {
        const found_index = this.state.past_binaries.indexOf(binary_and_args);
        if (found_index !== -1) {
            this.state.past_binaries.splice(found_index, 1);
        }
        this.state.past_binaries.unshift(binary_and_args); // add to beginning
        this.setState({ past_binaries: this.state.past_binaries });
        update_config_key("past_binaries", this.state.past_binaries || []);
    }
    /**
     * parse tokens with awareness of double quotes
     *
     * @param      {string}  user_input raw input from user
     * @return     {Object}  { the binary (string) and arguments (array) parsed from user input }
     */
    _parse_binary_and_args_from_user_input(user_input: any) {
        let list_of_params = Util.string_to_array_safe_quotes(user_input),
            binary = "",
            args: any = [],
            len = list_of_params.length;
        if (len === 1) {
            binary = list_of_params[0];
        } else if (len > 1) {
            binary = list_of_params[0];
            args = list_of_params.slice(1, len);
        }
        return { binary: binary, args: args.join(" ") };
    }
    render() {
        let button_text = "",
            title = "",
            placeholder = "";

        if (this.state.target_type === TARGET_TYPES.file) {
            button_text = "Load Binary";
            title =
                "Loads the binary and any arguments present in the input to the right. Backslashes are treated as escape characters. Windows users can either use two backslashes in paths, or forward slashes.";
            placeholder = "/path/to/target/executable -and -flags";
        } else if (this.state.target_type === TARGET_TYPES.server) {
            // https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Target-Manipulation.html#GDB_002fMI-Target-Manipulation
            // -target-select
            button_text = "Connect to gdbserver";
            title = "Connect GDB to the remote target.";
            placeholder = "examples: 127.0.0.1:9999 | /dev/ttya";
        } else if (this.state.target_type === TARGET_TYPES.process) {
            // -target-attach
            button_text = "Attach to Process";
            title =
                "Attach to a process pid or a file file outside of GDB, or a thread group gid. If attaching to a thread group, the id previously returned by ‘-list-thread-groups --available’ must be used. Note: to do this, you usually need to run gdbgui as sudo.";
            placeholder = "pid | gid | file";
        }

        return (
            <form className="flex flex-[2_0_0]">
                <div className="flex min-w-0 w-full h-9 items-center gap-2">
                    <div
                        ref={this.dropdownRef}
                        className="relative flex h-full"
                    >
                        <button
                            className="inline-flex w-8 items-center justify-center rounded border border-[var(--border)] bg-[var(--surface)] px-2 text-base text-[var(--accent)] shadow-sm hover:bg-[var(--hover)]"
                            type="button"
                            onClick={() =>
                                this.setState({
                                    dropdown_open: !this.state.dropdown_open,
                                })
                            }
                        >
                            <ChevronDown size={20} />
                        </button>

                        <ul
                            className={
                                this.state.dropdown_open
                                    ? "absolute left-0 top-9 z-[110] min-w-64 rounded border border-[var(--border)] bg-[var(--surface)] py-1 text-[var(--fg)] shadow-lg"
                                    : "hidden"
                            }
                        >
                            <li>
                                <button
                                    className="pointer w-full hover:bg-[var(--hover)]"
                                    onClick={() =>
                                        this.setState({
                                            target_type: TARGET_TYPES.file,
                                            dropdown_open: false,
                                        })
                                    }
                                >
                                    Load Binary
                                </button>
                            </li>
                            <li>
                                <button
                                    className="w-full px-3 py-2 hover:bg-[var(--hover)]"
                                    onClick={() =>
                                        this.setState({
                                            target_type: TARGET_TYPES.server,
                                            dropdown_open: false,
                                        })
                                    }
                                >
                                    Connect to gdbserver
                                </button>
                            </li>
                            <li>
                                <button
                                    className="w-full px-3 py-2 hover:bg-[var(--hover)]"
                                    onClick={() =>
                                        this.setState({
                                            target_type: TARGET_TYPES.process,
                                            dropdown_open: false,
                                        })
                                    }
                                >
                                    Attach to Process
                                </button>
                            </li>
                        </ul>

                        <button
                            type="button"
                            title={title}
                            onClick={this.set_target_app.bind(this)}

                            className="inline-flex items-center rounded border border-[var(--border)] bg-[var(--accent)] px-4 hover:opacity-90"
                            style={{ color: "var(--bg)" }}
                        >
                            {button_text}
                        </button>
                    </div>

                    <div className="min-w-0 flex-1">
                        <CompletionDropdown
                            initial_value={this.state.user_input}
                            list={this.state.past_binaries}
                            placeholder={placeholder}
                            show_all_on_empty
                            onChange={this.onchange_user_input.bind(this)}
                            onSelect={this.onselect_user_input.bind(this)}
                            onSubmit={this.set_target_app.bind(this)}
                        />
                    </div>
                </div>
                <ToolTipTourguide
                    step_num={1}
                    position={"bottomcenter"}
                    content={
                        <div>
                            <h5>
                                Enter the path to the binary you wish to debug
                                here.
                            </h5>
                            <p>This is the first thing you should do.</p>
                            <p>
                                The path can be absolute, or relative to where
                                gdbgui was launched from.
                            </p>
                        </div>
                    }
                />
                <ToolTipTourguide
                    step_num={2}
                    position={"bottomleft"}
                    content={
                        <div>
                            <h5>
                                Press this button to load the executable
                                specified in the input.
                            </h5>
                            <p>This is the second thing you should do.</p>

                            <p>
                                Debugging won't start, but you will be able to
                                set breakpoints. If present,{" "}
                                <a href="https://en.wikipedia.org/wiki/Debug_symbol">
                                    debugging symbols
                                </a>{" "}
                                in the binary are also loaded.
                            </p>
                            <p>
                                If you don't want to debug a binary, click the
                                dropdown to choose a different target type.
                            </p>
                        </div>
                    }
                />
            </form>
        );
    }
}

export default BinaryLoader;
