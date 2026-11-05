import React from "react";
import { store } from "statorgfc";

import Actions from "./Actions";
import { input_style } from "./styles";
import CompletionDropdown from "./CompletionDropdown";

type InferiorProgramInfoState = any;

type InferiorProgramInfoProps = {
    signals: Record<string, number>;
};

class InferiorProgramInfo extends React.Component<
    InferiorProgramInfoProps,
    InferiorProgramInfoState
> {
    constructor(props: InferiorProgramInfoProps) {
        super(props);
        store.connectComponentState(this, ["inferior_pid", "gdb_pid"]);
        // SIGKILL and SIGINT first, then the rest
        const ordered = Object.keys(this.props.signals).sort((a, b) => {
            const rank = (s: string) =>
                s === "SIGINT" ? 0 : s === "SIGKILL" ? 1 : 2;
            return rank(a) - rank(b) || a.localeCompare(b);
        });
        this.state = {
            selected_signal: "",
            other_pid: "",
            ordered: ordered.map(
                (s: string) => `${s} (${this.props.signals[s]})`,
            ),
        };
    }

    render() {
        let gdb_button = (
            <button
                className="btn"
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
                    className="btn"
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
            <div className="text-[var(--fg)]">
                <div className="flex flex-wrap gap-1 items-center">
                    <span>Send</span>

                    <CompletionDropdown
                        list={this.state.ordered}
                        placeholder="Select signal"
                        onSelect={(val: string) =>
                            this.setState({
                                selected_signal: val.split(" ")[0],
                            })
                        }
                        show_all_on_empty
                    />

                    <span>to</span>
                    {inferior_button && (
                        <>
                            {inferior_button}
                            <span>or</span>
                        </>
                    )}
                    {gdb_button}
                    <span>or</span>
                    <button
                        className="btn"
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
