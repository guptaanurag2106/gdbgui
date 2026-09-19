import React from "react";

import { store } from "statorgfc";
import BinaryLoader from "./BinaryLoader";
import ControlButtons from "./ControlButtons";
import SourceCodeHeading from "./SourceCodeHeading";
import ToolTipTourguide from "./ToolTipTourguide";
import FileOps from "./FileOps";
import GdbApi from "./GdbApi";
import Actions from "./Actions";
import constants from "./constants";
import Util from "./Util";
import { update_config_key } from "./Config";
import { Menu, Loader2 } from "lucide-react";

const top_bar_action_class =
    "inline-flex h-full items-center px-1 bg-[var(--accent)] hover:opacity-90 disabled:cursor-not-allowed";
const top_bar_action_style: React.CSSProperties = { color: "var(--bg)" };

let show_license = function () {
    Actions.show_modal(
        "gdbgui license",
        <React.Fragment>
            <a href="https://github.com/guptaanurag2106/gdbgui/blob/master/LICENSE">
                GNU General Public License v3.0
            </a>
            <p>Copyright © Chad Smith (original), Anurag Gupta (fork)</p>
            <p>
                This software can be used personally or commercially for free.
            </p>
            <p>
                Permissions of this strong copyleft license are conditioned on
                making available complete source code of licensed works and
                modifications, which include larger works using a licensed work,
                under the same license. Copyright and license notices must be
                preserved. Contributors provide an express grant of patent
                rights.
            </p>
            <p>
                If you wish to redistribute gdbgui as part of a closed source
                product, you can do so for a fee.
            </p>
        </React.Fragment>,
    );
};

let show_about = function () {
    Actions.show_modal(
        "About gdbgui",
        <div>
            <div>gdbgui, v{store.get("gdbgui_version")}</div>
            <div>Copyright © Chad Smith (original), Anurag Gupta (fork)</div>
            <div>
                <a href="https://github.com/guptaanurag2106">
                    github/guptaanurag2106
                </a>
            </div>
        </div>,
    );
};

let show_session_info = function () {
    Actions.show_modal(
        "session information",
        <React.Fragment>
            <table>
                <tbody>
                    <tr>
                        <td>gdb version: {store.get("gdb_version")}</td>
                    </tr>
                    <tr>
                        <td>gdb pid for this tab: {store.get("gdb_pid")}</td>
                    </tr>
                    <tr>
                        <td>gdbgui v{store.get("gdbgui_version")}</td>
                    </tr>
                </tbody>
            </table>
        </React.Fragment>,
    );
};

let get_menu = function (open: boolean, on_toggle: () => void) {
    return (
        <div>
            <button
                className="text-[var(--fg)] hover:text-[var(--accent)]"
                onClick={(e) => {
                    e.preventDefault();
                    on_toggle();
                }}
            >
                <Menu size={20} />
            </button>
            <ul
                className={
                    open
                        ? "absolute right-0 top-11 z-[110] min-w-52 rounded border border-[var(--border)] bg-[var(--surface)] py-1 text-[var(--fg)] shadow-lg"
                        : "hidden"
                }
                onClick={() => on_toggle()}
            >
                <li>
                    <button
                        onClick={() =>
                            store.set(
                                "show_settings",
                                !store.get("show_settings"),
                            )
                        }
                        title="settings"
                        className="w-full px-3 py-2 hover:bg-[var(--hover)]"
                    >
                        Settings
                    </button>
                </li>
                <li>
                    <button
                        className="w-full px-3 py-2 hover:bg-[var(--hover)]"
                        onClick={ToolTipTourguide.start_guide}
                    >
                        Show Guide
                    </button>
                </li>
                <li>
                    <button
                        onClick={show_session_info}
                        className="w-full px-3 py-2 hover:bg-[var(--hover)]"
                    >
                        Session Information
                    </button>
                </li>
                <li>
                    <button
                        onClick={show_license}
                        className="w-full px-3 py-2 hover:bg-[var(--hover)]"
                    >
                        License
                    </button>
                </li>
                <li>
                    <button
                        onClick={show_about}
                        className="w-full px-3 py-2 hover:bg-[var(--hover)]"
                    >
                        About gdbgui
                    </button>
                </li>
            </ul>

            <ToolTipTourguide
                top={"100%"}
                left={"-300px"}
                step_num={0}
                content={
                    <div>
                        <h5>Welcome to gdbgui.</h5>
                        <p>
                            This guide can be shown at any time by clicking the
                            menu button, ☰, then clicking "Show Guide".
                        </p>
                    </div>
                }
            />
        </div>
    );
};

interface TopBarState {
    assembly_flavor: "intel" | "att";
    show_spinner: boolean;
    show_hamburger_menu: boolean;
    waiting_for_response: boolean;
    source_code_state: string;
}
interface TopBarProps {
    initial_binary_and_args: string[];
}

//TODO:topbar doesn't show --project (project directory)
class TopBar extends React.Component<TopBarProps, TopBarState> {
    spinner_timeout: any;
    spinner_timeout_msec: any;
    hamburgerRef = React.createRef<HTMLDivElement>();
    constructor(props: TopBarProps) {
        super(props);
        // state local to the component
        this.state = {
            assembly_flavor: "intel", // default to intel (choices are 'att' or 'intel')
            show_spinner: false,
            show_hamburger_menu: false,
            waiting_for_response: false,
            source_code_state: constants.source_code_states.NONE_AVAILABLE,
        };
        // global state attached to this component
        store.connectComponentState(
            this,
            ["source_code_state", "waiting_for_response", "theme"],
            this.store_update_callback.bind(this),
        );

        this.spinner_timeout = null;
        this.spinner_timeout_msec = 5000;
    }
    componentDidMount() {
        document.addEventListener("mousedown", this._handle_click_outside);
    }
    componentWillUnmount() {
        document.removeEventListener("mousedown", this._handle_click_outside);
    }
    store_update_callback(keys: any) {
        if (keys.indexOf("waiting_for_response") !== -1) {
            this._clear_spinner_timeout();
            this.setState({ show_spinner: false });
            if (this.state.waiting_for_response === true) {
                // false to true
                this._set_spinner_timeout();
            }
        }
    }
    _handle_click_outside = (e: MouseEvent) => {
        if (
            this.state.show_hamburger_menu &&
            this.hamburgerRef.current &&
            !this.hamburgerRef.current.contains(e.target as Node)
        ) {
            this.setState({ show_hamburger_menu: false });
        }
    };
    _set_spinner_timeout() {
        this.spinner_timeout = setTimeout(() => {
            if (this.state.waiting_for_response) {
                this.setState({ show_spinner: true });
            }
        }, this.spinner_timeout_msec);
    }
    _clear_spinner_timeout() {
        clearTimeout(this.spinner_timeout);
    }
    toggle_assembly_flavor() {
        const new_flavour =
            this.state.assembly_flavor === "att" ? "intel" : "att";
        this.setState({ assembly_flavor: new_flavour });
        GdbApi.set_assembly_flavor(new_flavour);
        Actions.clear_cached_assembly();
        FileOps.fetch_assembly_cur_line();
    }
    //TODO: should i show this somewhere? fetch latest_gdbgui_version from github
    static needs_to_update_gdbgui_version() {
        // to actually check each value:
        try {
            return Util.is_newer(
                store.get("latest_gdbgui_version"),
                store.get("gdbgui_version"),
            );
        } catch (err) {
            console.error(err);
            return true;
        }
    }
    render() {
        let toggle_assm_button;
        if (
            this.state.source_code_state ===
                constants.source_code_states.ASSM_AND_SOURCE_CACHED ||
            this.state.source_code_state ===
                constants.source_code_states.ASSM_CACHED
        ) {
            toggle_assm_button = (
                <button
                    onClick={this.toggle_assembly_flavor.bind(this)}
                    type="button"
                    title={
                        "Toggle between assembly flavors. The options are Intel or AT&T."
                    }
                    className={top_bar_action_class}
                    style={top_bar_action_style}
                >
                    {this.state.assembly_flavor === "intel" ? "Intel" : "AT&T"}
                </button>
            );
        }

        let reload_button;
        if (
            this.state.source_code_state ===
                constants.source_code_states.ASSM_AND_SOURCE_CACHED ||
            this.state.source_code_state ===
                constants.source_code_states.SOURCE_CACHED
        ) {
            reload_button = (
                <button
                    onClick={FileOps.refresh_cached_source_files}
                    type="button"
                    title="Erase file from local cache and re-fetch it"
                    className={top_bar_action_class}
                    style={top_bar_action_style}
                >
                    Reload file
                </button>
            );
        }

        //TODO:not show unless file is loaded (same as condition for reload button??)
        let fetch_disassembly_button = (
            <button
                onClick={() => {
                    store.set("show_inline_disassembly", true);
                    FileOps.fetch_assembly_cur_line();
                }}
                type="button"
                title="fetch disassembly"
                className={top_bar_action_class}
                style={top_bar_action_style}
            >
                Fetch disassembly
            </button>
        );

        let toggle_inline_disassembly_button;
        let source_file_obj = FileOps.get_source_file_obj_from_cache(
            store.get("fullname_to_render"),
        );
        if (
            source_file_obj &&
            source_file_obj.assembly &&
            Object.keys(source_file_obj.assembly).length > 0
        ) {
            toggle_inline_disassembly_button = (
                <button
                    onClick={() =>
                        store.set(
                            "show_inline_disassembly",
                            !store.get("show_inline_disassembly"),
                        )
                    }
                    type="button"
                    title="Show/Hide disassembly"
                    className={top_bar_action_class}
                    style={top_bar_action_style}
                >
                    <span>
                        {store.get("show_inline_disassembly") ? "Hide" : "Show"}{" "}
                        disassembly
                    </span>
                </button>
            );
        }

        let spinner = <span className="inline-block h-6 w-3.5 shrink-0" />;
        if (this.state.show_spinner) {
            spinner = (
                <Loader2
                    size={20}
                    className="shrink-0 text-[var(--accent)] animate-spin"
                />
            );
        }

        return (
            <div
                className="text-[var(--fg)]"
                style={{
                    backgroundColor: "var(--topbar-bg)",
                    borderBottom: "5px solid var(--gutter)",
                    paddingBottom: "5px",
                }}
            >
                <div className="flex h-9 items-center justify-center gap-20">
                    <BinaryLoader
                        initial_binary_and_args={
                            this.props.initial_binary_and_args
                        }
                    />
                    {spinner}

                    <ControlButtons />
                    <div
                        ref={this.hamburgerRef}
                        className="h-full flex items-center"
                    >
                        {get_menu(this.state.show_hamburger_menu, () =>
                            this.setState({
                                show_hamburger_menu:
                                    !this.state.show_hamburger_menu,
                            }),
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 mt-4 h-7">
                    <button
                        className={top_bar_action_class}
                        style={top_bar_action_style}
                        title="Toggle file explorer visibility"
                        onClick={() => {
                            let middle_pane_sizes = store.get("middle_sizes"),
                                file_explorer_size = middle_pane_sizes[0],
                                source_size = middle_pane_sizes[1],
                                sidebar_size = middle_pane_sizes[2],
                                new_file_explorer_size,
                                new_source_size,
                                new_sidebar_size;

                            if (store.get("show_filesystem")) {
                                // hide it since it's shown right now
                                new_file_explorer_size = 0;
                                new_source_size =
                                    source_size + file_explorer_size / 2;
                                new_sidebar_size =
                                    sidebar_size + file_explorer_size / 2;
                            } else {
                                // show it - use stored sizes or defaults
                                new_file_explorer_size = Math.max(
                                    30,
                                    file_explorer_size || 30,
                                );
                                new_source_size = Math.max(
                                    30,
                                    source_size - new_file_explorer_size / 2,
                                );
                                new_sidebar_size =
                                    99 -
                                    new_file_explorer_size -
                                    new_source_size;
                            }

                            store.set(
                                "show_filesystem",
                                !store.get("show_filesystem"),
                            );
                            const new_sizes = [
                                new_file_explorer_size,
                                new_source_size,
                                new_sidebar_size,
                            ];
                            store.set("middle_sizes", new_sizes);
                            update_config_key("middle_sizes", new_sizes);
                        }}
                    >
                        {store.get("show_filesystem")
                            ? "Hide filesystem"
                            : "Show filesystem"}
                    </button>

                    {reload_button}

                    {fetch_disassembly_button}

                    {toggle_inline_disassembly_button}

                    {toggle_assm_button}

                    <SourceCodeHeading />
                </div>
            </div>
        );
    }
}

export default TopBar;
