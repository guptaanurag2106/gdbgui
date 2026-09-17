import React from "react";

import Actions from "./Actions";
import { store } from "statorgfc";
import { btn_style, input_style } from "./styles";
import { ChevronDown } from "lucide-react";

type State = any;

type Props = { signals: Record<string, string> };

class InferiorProgramInfo extends React.Component<Props, State> {
    dropdownRef = React.createRef<HTMLDivElement>();
    constructor(props: Props) {
        super(props);
        this.get_li_for_signal = this.get_li_for_signal.bind(this);
        this.get_dropdown = this.get_dropdown.bind(this);
        this.state = {
            selected_signal: "SIGINT",
            other_pid: "",
            dropdown_open: false,
        };
        store.connectComponentState(this, ["inferior_pid", "gdb_pid"]);
    }
    componentDidMount() {
        document.addEventListener("mousedown", this._handle_click_outside);
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
    get_li_for_signal(s: any, signal_key: any) {
        let onclick = function () {
            let obj = {};
            // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            obj[signal_key] = s;
            // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
            this.setState(obj);
        }.bind(this);

        return (
            <li
                key={s}
                className="px-2 py-1 cursor-pointer text-[var(--fg)] hover:bg-[var(--hover)]"
                value={s}
                onClick={onclick}
            >
                {`${s} (${this.props.signals[s]})`}
            </li>
        );
    }
    get_signal_choices(signal_key: any) {
        let signals = [];
        for (let s in this.props.signals) {
            if (s === "SIGKILL" || s === "SIGINT") {
                signals.push(this.get_li_for_signal(s, signal_key));
            }
        }
        for (let s in this.props.signals) {
            if (s !== "SIGKILL" && s !== "SIGINT") {
                signals.push(this.get_li_for_signal(s, signal_key));
            }
        }
        return signals;
    }
    get_dropdown() {
        return (
            <div
                ref={this.dropdownRef}
                style={{ display: "inline-block", position: "relative" }}
            >
                <button
                    style={btn_style}
                    type="button"
                    onClick={() =>
                        this.setState({
                            dropdown_open: !this.state.dropdown_open,
                        })
                    }
                >
                    {this.state.selected_signal}{" "}
                    <ChevronDown size={14} className="inline" />
                </button>
                {this.state.dropdown_open && (
                    <ul
                        className="absolute left-0 top-full z-[110] min-w-[140px] max-h-[300px] overflow-auto list-none m-0 p-0 border border-[var(--border)] bg-[var(--surface)] shadow-[0_2px_6px_rgba(0,0,0,0.3)]"
                        onClick={() => this.setState({ dropdown_open: false })}
                    >
                        {this.get_signal_choices("selected_signal")}
                    </ul>
                )}
            </div>
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
