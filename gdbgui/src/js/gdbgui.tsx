/**
 * This is the entrypoint to the frontend applicaiton.
 *
 * store (global state) is managed in a single location, and each time the store
 * changes, components are notified and update accordingly.
 *
 */

/* global initial_data */
/* global debug */

import ReactDOM from "react-dom";
import React from "react";
import { store, middleware } from "statorgfc";
import Split from "react-split";

import constants from "./constants";
import GdbApi from "./GdbApi";
import FileOps from "./FileOps";
import FoldersView from "./FoldersView";
import GlobalEvents from "./GlobalEvents";
import HoverVar from "./HoverVar";
import initial_store_data, { load_config, update_config_key } from "./Config";
import MiddleLeft from "./MiddleLeft";
import Modal from "./GdbguiModal";
import RightSidebar from "./RightSidebar";
import Settings from "./Settings";
import ToolTip from "./ToolTip";
import TopBar from "./TopBar";
import ToolTipTourguide from "./ToolTipTourguide";

import "../css/gdbgui.css";
import { Terminals } from "./Terminals";
import StatusFooter from "./StatusFooter";

class Gdbgui extends React.PureComponent<{}, any> {
    //TODO:componentWillMount vs constructor
    componentWillMount() {
        GdbApi.init();
        GlobalEvents.init();
        FileOps.init(); // this should be initialized before components that use store key 'source_code_state'
    }
    constructor(props: {}) {
        super(props);
        store.connectComponentState(this, ["theme", "middle_sizes"]);
    }
    render() {
        return (
            <div
                className={`splitjs_container pygments-${this.state.theme || ""}`}
            >
                <TopBar
                    initial_binary_and_args={
                        initial_data.initial_binary_and_args
                    }
                />

                <Split
                    direction="vertical"
                    sizes={[70, 30]}
                    gutterSize={5}
                    cursor="row-resize"
                    minSize={[100, 50]}
                    onDrag={() => window.dispatchEvent(new Event("resize"))}
                    style={{
                        flex: 1,
                        minHeight: 0,
                        width: "100%",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    <Split
                        direction="horizontal"
                        sizes={this.state.middle_sizes}
                        gutterSize={5}
                        cursor="col-resize"
                        minSize={[0, 100, 100]}
                        expandToMin={false}
                        onDrag={() => window.dispatchEvent(new Event("resize"))}
                        onDragEnd={(sizes: number[]) => {
                            store.set("middle_sizes", sizes);
                            update_config_key("middle_sizes", sizes);
                        }}
                        style={{
                            overflow: "hidden",
                            display: "flex",
                            flexDirection: "row",
                        }}
                    >
                        <div className="content">
                            <FoldersView />
                        </div>

                        <div className="content">
                            <MiddleLeft />
                        </div>

                        <div
                            className="content"
                            style={{
                                overflow: "auto",
                            }}
                        >
                            <RightSidebar
                                signals={initial_data.signals}
                                debug={debug}
                            />
                        </div>
                    </Split>

                    <div
                        className="content"
                        style={{
                            backgroundColor: "var(--topbar-bg)",
                        }}
                    >
                        <ToolTipTourguide
                            step_num={4}
                            position={"topleft"}
                            content={
                                <div>
                                    <h5>You can view gdb's output here.</h5>
                                    You usually don't need to enter commands
                                    here, but you have the option to if there is
                                    something you can't do in the UI.
                                </div>
                            }
                        />
                        <Terminals />
                    </div>
                </Split>

                <StatusFooter />

                {/* below are elements that are only displayed under certain conditions */}
                <Modal />
                <HoverVar />
                <Settings />
                <ToolTip />
                <textarea
                    style={{
                        width: "0px",
                        height: "0px",
                        position: "absolute",
                        top: "0",
                        left: "-1000px",
                    }}
                    ref={(node) => {
                        store.set("textarea_to_copy_to_clipboard", node);
                    }}
                />
            </div>
        );
    }
    componentDidMount() {
        if (debug) {
            console.warn("Unwatched keys: ", store.getUnwatchedKeys());
        }
    }
}

async function main() {
    await load_config(); // fetch GET /config, merge into initial_store_data

    const store_options = {
        immutable: false,
        debounce_ms: 10,
    };
    store.initialize(initial_store_data, store_options);
    if (debug) {
        // log call store changes in console except if changed key was in
        // constants.keys_to_not_log_changes_in_console
        store.use(function (key: any, oldval: any, newval: any) {
            if (
                constants.keys_to_not_log_changes_in_console.indexOf(key) === -1
            ) {
                middleware.logChanges(key, oldval, newval);
            }
            return true;
        });
    }
    // make this visible in the console
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'store' does not exist on type 'Window & ... Remove this comment to see the full error message
    window.store = store;
    ReactDOM.render(<Gdbgui />, document.getElementById("gdbgui"));
}
main();
