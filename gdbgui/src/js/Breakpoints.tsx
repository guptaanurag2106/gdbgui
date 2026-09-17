import React from "react";
import { store } from "statorgfc";
import GdbApi from "./GdbApi";
import Actions from "./Actions";
import Util from "./Util";
import FileOps from "./FileOps";
import { FileLink } from "./Links";
import constants from "./constants";
import { input_style } from "./styles";
import { Trash2, List, Pencil } from "lucide-react";

const BreakpointSourceLineCache = {
    _cache: {} as Record<string, Record<number, string>>,
    get_line: function (fullname: any, linenum: any) {
        const fileCache = BreakpointSourceLineCache._cache[fullname];
        if (fileCache && typeof fileCache[linenum] === "string") {
            return fileCache[linenum];
        }
        return null;
    },
    add_line: function (fullname: any, linenum: any, escaped_text: any) {
        if (
            BreakpointSourceLineCache._cache[fullname] === undefined ||
            typeof BreakpointSourceLineCache._cache[fullname] !== "object"
        ) {
            BreakpointSourceLineCache._cache[fullname] = {};
        }
        BreakpointSourceLineCache._cache[fullname][linenum] = escaped_text;
    },
};

type BreakpointState = any;

class Breakpoint extends React.Component<any, BreakpointState> {
    constructor(props: {}) {
        super(props);
        this.state = {
            breakpoint_condition: "",
            editing_breakpoint_condition: false,
        };
    }
    get_source_line(fullname: any, linenum: any) {
        // if we have the source file cached, we can display the line of text
        const MAX_CHARS_TO_SHOW_FROM_SOURCE = 40;
        let line = null;
        if (BreakpointSourceLineCache.get_line(fullname, linenum)) {
            line = BreakpointSourceLineCache.get_line(fullname, linenum);
        } else if (FileOps.line_is_cached(fullname, linenum, null)) {
            let syntax_highlighted_line = FileOps.get_line_from_file(
                fullname,
                linenum,
            );
            line = Util.get_text_from_html(syntax_highlighted_line).trim();

            if (line.length > MAX_CHARS_TO_SHOW_FROM_SOURCE) {
                line = line.slice(0, MAX_CHARS_TO_SHOW_FROM_SOURCE) + "...";
            }
            BreakpointSourceLineCache.add_line(fullname, linenum, line);
        }

        if (line) {
            return (
                <span className="monospace whitespace-nowrap text-[0.95em]">
                    {line || <br />}
                </span>
            );
        }
        return "(file not cached)";
    }
    get_delete_jsx(bkpt_num_to_delete: any) {
        return (
            <div
                className="inline-block w-3 pointer breakpoint_trashcan text-[var(--muted)] hover:text-[var(--accent-2)]"
                onClick={(e) => {
                    e.stopPropagation();
                    Breakpoints.delete_breakpoint(bkpt_num_to_delete);
                }}
                title={`Delete breakpoint ${bkpt_num_to_delete}`}
            >
                <Trash2 size={14} />
            </div>
        );
    }
    get_num_times_hit(bkpt: any) {
        if (
            bkpt.times === undefined || // E.g. 'bkpt' is a child breakpoint
            bkpt.times == 0
        ) {
            return "";
        } else if (bkpt.times == 1) {
            return "1 hit";
        } else {
            return `${bkpt.times} hits`;
        }
    }
    on_change_bkpt_cond(e: any) {
        this.setState({
            breakpoint_condition: e.target.value,
            editing_breakpoint_condition: true,
        });
    }
    on_key_up_bktp_cond(number: any, e: any) {
        if (e.keyCode === constants.ENTER_BUTTON_NUM) {
            this.setState({ editing_breakpoint_condition: false });
            Breakpoints.set_breakpoint_condition(e.target.value, number);
        }
    }
    on_break_cond_click(e: any) {
        this.setState({
            editing_breakpoint_condition: true,
        });
    }
    render() {
        let b = this.props.bkpt,
            checked = b.enabled === "y" ? "checked" : "",
            source_line = this.get_source_line(b.fullname_to_display, b.line);

        let info_glyph, function_jsx, bkpt_num_to_delete;
        if (b.is_child_breakpoint) {
            bkpt_num_to_delete = b.parent_breakpoint_number;
            info_glyph = (
                <span
                    className="text-[var(--muted)]"
                    title="Child breakpoint automatically created from parent. If parent or any child of this tree is deleted, all related breakpoints will be deleted."
                >
                    <List size={14} />
                </span>
            );
        } else if (b.is_parent_breakpoint) {
            info_glyph = (
                <span
                    className="text-[var(--muted)]"
                    title="Parent breakpoint with one or more child breakpoints. If parent or any child of this tree is deleted, all related breakpoints will be deleted."
                >
                    <List size={14} />
                </span>
            );
            bkpt_num_to_delete = b.number;
        } else {
            bkpt_num_to_delete = b.number;
            info_glyph = "";
        }

        const delete_jsx = this.get_delete_jsx(bkpt_num_to_delete);
        let location_jsx = (
            <FileLink
                fullname={b.fullname_to_display}
                file={b.fullname_to_display}
                line={b.line}
            />
        );

        if (b.is_parent_breakpoint) {
            function_jsx = (
                <span className="placeholder">
                    {info_glyph} parent breakpoint on inline, template, or
                    ambiguous location
                </span>
            );
        } else {
            let func = b.func === undefined ? "(unknown function)" : b.func;
            let break_condition = (
                <div
                    onClick={this.on_break_cond_click.bind(this)}
                    className="inline"
                    title={`${
                        this.state.breakpoint_condition
                            ? "Modify or remove"
                            : "Add"
                    } breakpoint condition`}
                >
                    <Pencil size={14} className="inline pointer" />
                    <span
                        className={`italic ${this.state.breakpoint_condition ? "bold" : ""}`}
                    >
                        condition
                    </span>
                </div>
            );
            if (this.state.editing_breakpoint_condition) {
                break_condition = (
                    <input
                        type="text"
                        style={input_style}
                        placeholder="Break condition"
                        onKeyUp={this.on_key_up_bktp_cond.bind(this, b.number)}
                        onChange={this.on_change_bkpt_cond.bind(this)}
                        value={this.state.breakpoint_condition}
                    />
                );
            }

            const times_hit = this.get_num_times_hit(b);
            function_jsx = (
                <div className="inline-flex items-center gap-2 flex-wrap">
                    <span className="monospace">
                        {info_glyph} {func}
                    </span>
                    <span className="text-[var(--muted)] italic">
                        thread groups: {b["thread-groups"]}
                    </span>
                    <span>{break_condition}</span>
                    <span className="text-[var(--muted)] italic">
                        {times_hit}
                    </span>
                </div>
            );
        }

        return (
            <div
                className="breakpoint rounded border border-[var(--border)] p-1.5 mb-1"
                onClick={() => Actions.view_file(b.fullname_to_display, b.line)}
            >
                <div className="flex items-start gap-1.5">
                    <input
                        type="checkbox"
                        className="mt-0.5 shrink-0"
                        checked={checked === "checked"}
                        onChange={() =>
                            Breakpoints.enable_or_disable_bkpt(
                                checked,
                                b.number,
                            )
                        }
                    />
                    <div className="min-w-0 flex-1">
                        <div>
                            {function_jsx} {delete_jsx}
                        </div>
                        <div>{location_jsx}</div>
                        <div className="text-[0.9em] text-[var(--muted)]">
                            {source_line}
                        </div>
                    </div>
                </div>
            </div>
        );
    } // render function
}

class Breakpoints extends React.Component {
    constructor(props: {}) {
        super(props);
        store.connectComponentState(this, ["breakpoints"]);
    }
    render() {
        let breakpoints_jsx = [];
        const breakpoints = store.get("breakpoints");
        const all_enabled =
            breakpoints.length > 0 &&
            breakpoints.every((b: any) => b.enabled === "y");
        const toggle_label = all_enabled
            ? "disable all breakpoints"
            : "enable all breakpoints";

        for (let b of breakpoints) {
            breakpoints_jsx.push(<Breakpoint bkpt={b} key={b.number} />);
        }

        if (breakpoints_jsx.length) {
            return (
                <div>
                    <div className="flex items-center gap-1.5 text-[var(--muted)] text-[14px] pl-1 pt-0.5">
                        <input
                            type="checkbox"
                            className="mt-0.5 shrink-0"
                            checked={all_enabled}
                            onChange={() =>
                                Breakpoints.enable_or_disable_all(all_enabled)
                            }
                        />
                        <span>{toggle_label}</span>
                    </div>

                    {breakpoints_jsx}
                </div>
            );
        } else {
            return <span className="placeholder">no breakpoints</span>;
        }
    }
    static enable_or_disable_all(all_enabled: boolean) {
        if (all_enabled) {
            GdbApi.run_gdb_command(["disable", GdbApi.get_break_list_cmd()]);
        } else {
            GdbApi.run_gdb_command(["enable", GdbApi.get_break_list_cmd()]);
        }
    }
    static enable_or_disable_bkpt(checked: any, bkpt_num: any) {
        if (checked) {
            GdbApi.run_gdb_command([
                `-break-disable ${bkpt_num}`,
                GdbApi.get_break_list_cmd(),
            ]);
        } else {
            GdbApi.run_gdb_command([
                `-break-enable ${bkpt_num}`,
                GdbApi.get_break_list_cmd(),
            ]);
        }
    }
    static set_breakpoint_condition(condition: any, bkpt_num: any) {
        GdbApi.run_gdb_command([
            `-break-condition ${bkpt_num} ${condition}`,
            GdbApi.get_break_list_cmd(),
        ]);
    }
    static remove_breakpoint_if_present(fullname: any, line: any) {
        if (Breakpoints.has_breakpoint(fullname, line)) {
            let number = Breakpoints.get_breakpoint_number(fullname, line);
            let cmd = [
                GdbApi.get_delete_break_cmd(number),
                GdbApi.get_break_list_cmd(),
            ];
            GdbApi.run_gdb_command(cmd);
        }
    }
    static add_or_remove_breakpoint(fullname: any, line: any) {
        if (Breakpoints.has_breakpoint(fullname, line)) {
            Breakpoints.remove_breakpoint_if_present(fullname, line);
        } else {
            Breakpoints.add_breakpoint(fullname, line);
        }
    }
    static add_breakpoint(fullname: any, line: any) {
        GdbApi.run_gdb_command(GdbApi.get_insert_break_cmd(fullname, line));
    }
    static has_breakpoint(fullname: any, line: any) {
        let bkpts = store.get("breakpoints");
        for (let b of bkpts) {
            if (b.fullname === fullname && b.line == line) {
                return true;
            }
        }
        return false;
    }
    static get_breakpoint_number(fullname: any, line: any) {
        let bkpts = store.get("breakpoints");
        for (let b of bkpts) {
            if (b.fullname === fullname && b.line == line) {
                return b.number;
            }
        }
        console.error(`could not find breakpoint for ${fullname}:${line}`);
    }
    static delete_breakpoint(breakpoint_number: any) {
        GdbApi.run_gdb_command([
            GdbApi.get_delete_break_cmd(breakpoint_number),
            GdbApi.get_break_list_cmd(),
        ]);
    }
    static get_breakpoint_lines_for_file(fullname: any) {
        return store
            .get("breakpoints")
            .filter(
                (b: any) =>
                    b.fullname_to_display === fullname && b.enabled === "y",
            )
            .map((b: any) => parseInt(b.line));
    }
    static get_disabled_breakpoint_lines_for_file(fullname: any) {
        return store
            .get("breakpoints")
            .filter(
                (b: any) =>
                    b.fullname_to_display === fullname && b.enabled !== "y",
            )
            .map((b: any) => parseInt(b.line));
    }
    static get_conditional_breakpoint_lines_for_file(fullname: any) {
        return store
            .get("breakpoints")
            .filter(
                (b: any) =>
                    b.fullname_to_display === fullname && b.cond !== undefined,
            )
            .map((b: any) => parseInt(b.line));
    }
    static save_breakpoints(payload: any) {
        store.set("breakpoints", []);
        if (
            payload &&
            payload.BreakpointTable &&
            payload.BreakpointTable.body
        ) {
            for (let breakpoint of payload.BreakpointTable.body) {
                Breakpoints.save_breakpoint(breakpoint);
            }
        }
    }
    static save_breakpoint(breakpoint: any) {
        let bkpt = Object.assign({}, breakpoint);

        bkpt.is_parent_breakpoint = bkpt.addr === "(MULTIPLE)";

        // parent breakpoints have numbers like "5.6", whereas normal breakpoints and parent breakpoints have numbers like "5"
        bkpt.is_child_breakpoint =
            parseInt(bkpt.number) !== parseFloat(bkpt.number);
        bkpt.is_normal_breakpoint =
            !bkpt.is_parent_breakpoint && !bkpt.is_child_breakpoint;

        if (bkpt.is_child_breakpoint) {
            bkpt.parent_breakpoint_number = parseInt(bkpt.number);
        }

        if ("fullname" in breakpoint && breakpoint.fullname) {
            // this is a normal/child breakpoint; gdb gives it the fullname
            bkpt.fullname_to_display = breakpoint.fullname;
        } else if (
            "original-location" in breakpoint &&
            breakpoint["original-location"]
        ) {
            // this breakpoint is the parent breakpoint of multiple other breakpoints. gdb does not give it
            // the fullname field, but rather the "original-location" field.
            // example breakpoint['original-location']: /home/file.h:19
            // so we need to parse out the line number, and store it
            [bkpt.fullname_to_display, bkpt.line] =
                Util.parse_fullname_and_line(breakpoint["original-location"]);
        } else {
            bkpt.fullname_to_display = null;
        }

        // add the breakpoint if it's not stored already
        let bkpts = store.get("breakpoints");
        if (bkpts.indexOf(bkpt) === -1) {
            bkpts.push(bkpt);
            store.set("breakpoints", bkpts);
        }
        return bkpt;
    }
}

export default Breakpoints;
