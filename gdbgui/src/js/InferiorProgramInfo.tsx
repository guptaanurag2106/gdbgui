import React from "react";

import Actions from "./Actions";
import { store } from "statorgfc";
import { btn_style, input_style } from "./styles";

type State = any;

type Props = { signals: Record<string, string> };

class InferiorProgramInfo extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            selected_signal: "SIGINT",
            other_pid: "",
        };
        store.connectComponentState(this, ["inferior_pid", "gdb_pid"]);
    }
    get_signal_options() {
        // SIGKILL and SIGINT first, then the rest
        const ordered = Object.keys(this.props.signals).sort((a, b) => {
            const rank = (s: string) =>
                s === "SIGINT" ? 0 : s === "SIGKILL" ? 1 : 2;
            return rank(a) - rank(b) || a.localeCompare(b);
        });
        return ordered.map((s) => (
            <option key={s} value={s}>
                {`${s} (${this.props.signals[s]})`}
            </option>
        ));
    }
    get_dropdown() {
        // Native select: the browser renders the popup list in its own
        // layer, so it is never clipped by the sidebar's overflow and
        // never shifts layout or covers the sections below.
        return (
            <select
                style={{ ...input_style, width: "auto" }}
                value={this.state.selected_signal}
                onChange={(e) => {
                    this.setState({
                        selected_signal: e.currentTarget.value,
                    });
                }}
            >
                {this.get_signal_options()}
            </select>
        );
    }
    render() {
        let gdb_button = (
            <button
                style={btn_style}
                type="button"
                title="Send signal to gdb"
                onClick={() =>
                    Actions.send_signal(
                        this.state.selected_signal,
                        this.state.gdb_pid,
                    )
                }
            >
                {`gdb (pid ${this.state.gdb_pid})`}
            </button>
        );

        let inferior_button = null;
        if (this.state.inferior_pid) {
            inferior_button = (
                <button
                    style={btn_style}
                    type="button"
                    title="Send signal to program being debugged"
                    onClick={() =>
                        Actions.send_signal(
                            this.state.selected_signal,
                            this.state.inferior_pid,
                        )
                    }
                >
                    {`program (pid ${this.state.inferior_pid})`}
                </button>
            );
        }

        return (
            <div className="p-1.5 text-[var(--fg)]">
                <div className="flex flex-wrap gap-1 items-center">
                    <span>send</span>
                    {this.get_dropdown()}
                    <span>to</span>
                    {gdb_button}
                    <span>or</span>
                    {inferior_button && (
                        <>
                            {inferior_button}
                            <span>or</span>
                        </>
                    )}
                    <button
                        className="disabled:opacity-50 disabled:cursor-not-allowed"
                        style={btn_style}
                        disabled={!this.state.other_pid}
                        type="button"
                        title="Send signal to custom PID. Enter PID to enable this button."
                        onClick={() =>
                            Actions.send_signal(
                                this.state.selected_signal,
                                this.state.other_pid,
                            )
                        }
                    >
                        other pid
                    </button>
                    <input
                        placeholder="pid"
                        style={input_style}
                        onChange={(e) => {
                            this.setState({ other_pid: e.currentTarget.value });
                        }}
                        value={this.state.other_pid}
                    />
                </div>
            </div>
        );
    }
}

export default InferiorProgramInfo;
