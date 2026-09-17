/**
 * A component to show/hide variable exploration when hovering over a variable
 * in the source code
 */

import { store } from "statorgfc";
import React from "react";

import Breakpoints from "./Breakpoints";
import constants from "./constants";
import Expressions from "./Expressions";
import GdbMiOutput from "./GdbMiOutput";
import InferiorProgramInfo from "./InferiorProgramInfo";
import Locals from "./Locals";
import Memory from "./Memory";
import Registers from "./Registers";
import Tree from "./Tree";
import Threads from "./Threads";
import ToolTipTourguide from "./ToolTipTourguide";
import { base_style, input_style } from "./styles";
import { ChevronDown, ChevronRight } from "lucide-react";

let onmouseup_in_parent_callbacks: any = [],
    onmousemove_in_parent_callbacks: any = [];

let onmouseup_in_parent_callback = function () {
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'fn' implicitly has an 'any' type.
    onmouseup_in_parent_callbacks.map((fn) => fn());
};
let onmousemove_in_parent_callback = function (e: any) {
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'fn' implicitly has an 'any' type.
    onmousemove_in_parent_callbacks.map((fn) => {
        fn(e);
    });
};

type OwnCollapserState = any;

type CollapserProps = {
    id: string | undefined;
    title: string;
    content: any;
    collapsed: boolean;
};
type CollapserState = OwnCollapserState & typeof Collapser.defaultProps;

const titlebar_style = {
    cursor: "pointer",
    padding: "6px 8px",
    borderBottom: "1px solid var(--border)",
    fontSize: "14px",
    fontWeight: "bold" as const,
    color: "var(--fg)",
    backgroundColor: "var(--hover)",
    userSelect: "none" as const,
};

class Collapser extends React.Component<CollapserProps, CollapserState> {
    static defaultProps = { collapsed: false, id: "" };
    _height_when_clicked: any;
    _page_y_orig: any;
    _resizing: any;
    collapser_box_node: any;
    constructor(props: CollapserProps) {
        super(props);
        this.state = {
            collapsed: props.collapsed,
            autosize: true,
            height_px: null,
            _mouse_y_click_pos_px: null,
            _height_when_clicked: null,
        };
        this.onmousedown_resizer = this.onmousedown_resizer.bind(this);
        this.onmouseup_resizer = this.onmouseup_resizer.bind(this);
        this.onmousemove_resizer = this.onmousemove_resizer.bind(this);
        this.onclick_restore_autosize =
            this.onclick_restore_autosize.bind(this);

        onmouseup_in_parent_callbacks.push(this.onmouseup_resizer.bind(this));
        onmousemove_in_parent_callbacks.push(
            this.onmousemove_resizer.bind(this),
        );
    }
    toggle_visibility() {
        this.setState({ collapsed: !this.state.collapsed });
    }
    onmousedown_resizer(e: any) {
        this._resizing = true;
        this._page_y_orig = e.pageY;
        this._height_when_clicked = this.collapser_box_node.clientHeight;
    }
    onmouseup_resizer() {
        this._resizing = false;
    }
    onmousemove_resizer(e: any) {
        if (this._resizing) {
            let dh = e.pageY - this._page_y_orig;
            this.setState({
                height_px: this._height_when_clicked + dh,
                autosize: false,
            });
        }
    }
    onclick_restore_autosize() {
        this.setState({ autosize: true });
    }
    render() {
        let reset_size_button: JSX.Element | null = null;
        if (!this.state.autosize) {
            reset_size_button = (
                <span
                    onClick={this.onclick_restore_autosize}
                    title={
                        "Height frozen at " +
                        this.state.height_px +
                        "px. Click to restore autosize."
                    }
                    style={{
                        cursor: "pointer",
                        color: "var(--muted)",
                        fontSize: "11px",
                    }}
                >
                    reset height
                </span>
            );
        }

        let resizer: JSX.Element | null = null;
        if (!this.state.collapsed) {
            resizer = (
                <div
                    onMouseDown={this.onmousedown_resizer}
                    style={{ textAlign: "right", cursor: "ns-resize" }}
                    title="Click and drag to resize height"
                >
                    {reset_size_button}
                </div>
            );
        }

        return (
            <div>
                <div
                    style={titlebar_style}
                    onClick={this.toggle_visibility.bind(this)}
                >
                    {this.state.collapsed ? (
                        <ChevronRight size={14} className="inline" />
                    ) : (
                        <ChevronDown size={14} className="inline" />
                    )}{" "}
                    {this.props.title}
                </div>

                <div
                    className={this.state.collapsed ? "hidden" : ""}
                    id={this.props.id}
                    style={{
                        height: this.state.autosize
                            ? "auto"
                            : this.state.height_px + "px",
                        overflow: this.state.autosize ? "visible" : "auto",
                        padding: "4px 6px",
                        ...base_style,
                    }}
                    ref={(n) => (this.collapser_box_node = n)}
                >
                    {this.props.content}
                </div>

                {resizer}
            </div>
        );
    }
}

type RightSidebarProps = {
    debug: boolean;
    signals: any;
};
class RightSidebar extends React.Component<RightSidebarProps, any> {
    constructor(props: RightSidebarProps) {
        super(props);
        store.connectComponentState(this, ["theme"]);
    }
    render() {
        let mi_output: JSX.Element | null = null;
        if (this.props.debug) {
            mi_output = (
                <Collapser title="gdb mi output" content={<GdbMiOutput />} />
            );
        }

        return (
            <div
                style={{
                    backgroundColor: "var(--topbar-bg)",
                    overflow: "auto",
                    fontSize: "14px",
                    color: "var(--fg)",
                }}
                onMouseUp={onmouseup_in_parent_callback}
                onMouseMove={onmousemove_in_parent_callback}
            >
                <ToolTipTourguide
                    position={"topleft"}
                    content={
                        <div>
                            <h5>
                                This sidebar contains a visual, interactive
                                representation of the state of your program
                            </h5>
                            <p>
                                You can see which function the process is
                                stopped in, explore variables, and much more.
                            </p>
                            <p>
                                There is more to discover, but this should be
                                enough to get you started.
                            </p>
                            <p>
                                Something missing? Found a bug?{" "}
                                <a href="https://github.com/guptaanurag2106/gdbgui/issues/">
                                    Create an issue
                                </a>{" "}
                                on github.
                            </p>

                            <p>Happy debugging!</p>
                        </div>
                    }
                    step_num={5}
                />

                <Collapser
                    title="threads"
                    collapsed={false}
                    content={<Threads />}
                />

                <Collapser
                    id="locals"
                    title="local variables"
                    content={<Locals />}
                />
                <Collapser
                    id="expressions"
                    title="expressions"
                    content={<Expressions />}
                />
                <Collapser
                    title="Tree"
                    collapsed={true}
                    content={
                        <div className="flex gap-1.5 mb-1">
                            <input
                                id="tree_width"
                                placeholder="width (px)"
                                style={{ ...input_style }}
                            />
                            <input
                                id="tree_height"
                                placeholder="height (px)"
                                style={{ ...input_style }}
                            />
                            <div id={constants.tree_component_id} />
                        </div>
                    }
                />
                <Collapser
                    id="memory"
                    title="memory"
                    collapsed={true}
                    content={<Memory />}
                />
                <Collapser title="breakpoints" content={<Breakpoints />} />
                <Collapser
                    title="registers"
                    collapsed={true}
                    content={<Registers />}
                />
                <Collapser
                    title="signals"
                    collapsed={true}
                    content={
                        <InferiorProgramInfo signals={this.props.signals} />
                    }
                />

                {mi_output}
            </div>
        );
    }
    componentDidMount() {
        Tree.init();
    }
}
export default RightSidebar;
