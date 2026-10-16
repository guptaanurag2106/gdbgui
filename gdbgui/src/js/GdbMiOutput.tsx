/**
 * A component to display, in gory detail, what is
 * returned from gdb's machine interface. This displays the
 * data source that is fed to all components and UI elements
 * in gdb gui, and is useful when debugging gdbgui, or
 * a command that failed but didn't have a useful failure
 * message in gdbgui.
 */
import React from "react";
import { store } from "statorgfc";
import Util from "./Util";
import { Ban } from "lucide-react";

type State = any;

class GdbMiOutput extends React.Component<{}, State> {
    static MAX_OUTPUT_ENTRIES = 500;
    _debounced_scroll_to_bottom: any;
    el: any;
    constructor(props: {}) {
        super(props);
        store.connectComponentState(this, ["gdb_mi_output"]);
        this._debounced_scroll_to_bottom = Util.debounce(
            this._scroll_to_bottom.bind(this),
            300,
            {
                leading: true,
            },
        );
    }

    componentDidMount() {
        this.el = document.getElementById("gdb_mi_output");
    }

    componentDidUpdate() {
        this._debounced_scroll_to_bottom();
    }

    _scroll_to_bottom() {
        this.el.scrollTop = this.el.scrollHeight;
    }

    static add_mi_output(mi_obj: any) {
        let new_str = JSON.stringify(mi_obj, null, 4)
                // @ts-expect-error ts-migrate(2554) FIXME: Expected 2 arguments, but got 1.
                .replace(/[^(\\)]\\n/g)
                .replace("<", "&lt;")
                .replace(">", "&gt;"),
            gdb_mi_output = store.get("gdb_mi_output");

        gdb_mi_output.push(new_str);
        while (gdb_mi_output.length > GdbMiOutput.MAX_OUTPUT_ENTRIES) {
            gdb_mi_output.shift();
        }

        store.set("gdb_mi_output", gdb_mi_output);
    }

    render() {
        return (
            <div>
                <button
                    title="clear all mi output"
                    className="pointer inline-flex items-center gap-1 bg-[var(--accent)] px-1 py-1 text-[14px] hover:opacity-90"
                    style={{ color: "var(--bg)" }}
                    onClick={() => store.set("gdb_mi_output", [])}
                >
                    clear output
                    <Ban size={14} />
                </button>
                <div id="gdb_mi_output" className="mt-1 font-mono text-xs">
                    {this.state.gdb_mi_output.map((s: string, i: number) => (
                        <div key={i}>
                            <p>{s}</p>
                            <br />
                        </div>
                    ))}
                </div>
            </div>
        );
    }
}

export default GdbMiOutput;
