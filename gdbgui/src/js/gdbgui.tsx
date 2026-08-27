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
import initial_store_data from "./InitialStoreData";
import MiddleLeft from "./MiddleLeft";
import Modal from "./GdbguiModal";
import RightSidebar from "./RightSidebar";
import Settings from "./Settings";
import ToolTip from "./ToolTip";
import TopBar from "./TopBar";
import ToolTipTourguide from "./ToolTipTourguide";

import "../css/gdbgui.css";
import { Terminals } from "./Terminals";

const store_options = {
  immutable: false,
  debounce_ms: 10
};
// @ts-expect-error ts-migrate(2339) FIXME: Property 'initialize' does not exist on type '{ ge... Remove this comment to see the full error message
store.initialize(initial_store_data, store_options);
if (debug) {
  // log call store changes in console except if changed key was in
  // constants.keys_to_not_log_changes_in_console
  // @ts-expect-error ts-migrate(2339) FIXME: Property 'use' does not exist on type '{ get(key: ... Remove this comment to see the full error message
  store.use(function(key: any, oldval: any, newval: any) {
    if (constants.keys_to_not_log_changes_in_console.indexOf(key) === -1) {
      middleware.logChanges(key, oldval, newval);
    }
    return true;
  });
}
// make this visible in the console
// @ts-expect-error ts-migrate(2339) FIXME: Property 'store' does not exist on type 'Window & ... Remove this comment to see the full error message
window.store = store;

class Gdbgui extends React.PureComponent<{}, any> {
  componentWillMount() {
    GdbApi.init();
    GlobalEvents.init();
    FileOps.init(); // this should be initialized before components that use store key 'source_code_state'
  }
  constructor() {
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 1-2 arguments, but got 0.
    super();
    store.connectComponentState(this, ["current_theme", "middle_sizes"]);
  }
  render() {
    return (
      <div className={`splitjs_container ${this.state.current_theme || ""}`}>
        {/* @ts-expect-error ts-migrate(2322) FIXME: Property 'initial_user_input' does not exist on ty... Remove this comment to see the full error message */}
        <TopBar initial_user_input={initial_data.initial_binary_and_args} />

        <Split
          direction="vertical"
          sizes={[70, 30]}
          gutterSize={8}
          cursor="row-resize"
          minSize={[100, 50]}
          onDrag={() => window.dispatchEvent(new Event("resize"))}
          style={{
            height: "100%",
            width: "100%",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column"
          }}
        >
          <div
            id="middle"
            style={{ paddingTop: "60px", boxSizing: "border-box" }}
            className="flex flex-col overflow-hidden"
          >
            <Split
              direction="horizontal"
              sizes={this.state.middle_sizes}
              gutterSize={8}
              cursor="col-resize"
              minSize={[0, 100, 100]}
              expandToMin={false}
              onDrag={() => window.dispatchEvent(new Event("resize"))}
              onDragEnd={(sizes: number[]) => {
                store.set("middle_sizes", sizes);
                localStorage.setItem("middle_sizes", JSON.stringify(sizes));
              }}
              style={{
                flex: 1,
                minHeight: 0,
                overflow: "hidden",
                display: "flex",
                flexDirection: "row"
              }}
            >
              <div
                id="folders_view"
                className="content"
                style={{ backgroundColor: "#333" }}
              >
                <FoldersView />
              </div>

              <div id="source_code_view" className="content">
                <MiddleLeft />
              </div>

              <div id="controls_sidebar" className="content">
                {/* @ts-expect-error ts-migrate(2769) FIXME: Property 'signals' does not exist on type 'Intrins... Remove this comment to see the full error message */}
                <RightSidebar signals={initial_data.signals} debug={debug} />
              </div>
            </Split>
          </div>

          <div id="bottom" className="flex flex-col overflow-hidden">
            <ToolTipTourguide
              // @ts-expect-error ts-migrate(2322) FIXME: Property 'step_num' does not exist on type 'Intrin... Remove this comment to see the full error message
              step_num={4}
              position={"topleft"}
              content={
                <div>
                  <h5>You can view gdb's output here.</h5>
                  You usually don't need to enter commands here, but you have the option
                  to if there is something you can't do in the UI.
                </div>
              }
            />

            <div
              id="bottom_content"
              className="content"
              style={{
                flex: 1,
                minHeight: 0,
                backgroundColor: "#000"
              }}
            >
              <Terminals />
            </div>
          </div>
        </Split>

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
            left: "-1000px"
          }}
          ref={node => {
            store.set("textarea_to_copy_to_clipboard", node);
          }}
        />
      </div>
    );
  }
  componentDidMount() {
    if (debug) {
      // @ts-expect-error ts-migrate(2339) FIXME: Property 'getUnwatchedKeys' does not exist on type... Remove this comment to see the full error message
      console.warn(store.getUnwatchedKeys());
    }
  }
}

ReactDOM.render(<Gdbgui />, document.getElementById("gdbgui"));
