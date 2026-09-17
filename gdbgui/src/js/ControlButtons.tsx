import React from "react";

import Actions from "./Actions";
import GdbApi from "./GdbApi";
import { store } from "statorgfc";
import ToolTipTourguide from "./ToolTipTourguide";
import {
    RotateCcw,
    Play,
    Pause,
    StepForward,
    ArrowDown,
    ArrowUp,
} from "lucide-react";

type State = any;

class ControlButtons extends React.Component<{}, State> {
    constructor(props: {}) {
        super(props);
        store.connectComponentState(this, ["reverse_supported"]);
    }
    render() {
        let btn_class =
            "inline-flex h-full px-2 items-center border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] hover:bg-[var(--hover)]";

        return (
            <div>
                <ToolTipTourguide
                    step_num={3}
                    position={"bottomleft"}
                    onClick={(e: any) => e.stopPropagation()}
                    content={
                        <div>
                            <h5>
                                These buttons allow you to control execution of
                                the target you are debugging.
                            </h5>
                            <p>
                                Hover over these buttons to see a description of
                                their action. For example, the{" "}
                                <RotateCcw size={12} className="inline" />{" "}
                                button starts (or restarts) a program from the
                                beginning.
                            </p>
                            <p>
                                Each button has a keyboard shortcut. For
                                example, you can press "r" to start running.
                            </p>
                        </div>
                    }
                />
                <div className="h-9 gap-0 flex items-center justify-center">
                    <button
                        id="run_button"
                        onClick={() => GdbApi.click_run_button()}
                        type="button"
                        title="Start inferior program from the beginning keyboard shortcut: r"
                        className={btn_class}
                    >
                        <RotateCcw size={12} />
                    </button>

                    <button
                        id="continue_button"
                        onClick={() => GdbApi.click_continue_button()}
                        type="button"
                        title={
                            "Continue until breakpoint is hit or inferior program exits keyboard shortcut: c" +
                            (this.state.reverse_supported
                                ? ". shift + c for reverse."
                                : "")
                        }
                        className={btn_class}
                    >
                        <Play size={13} />
                    </button>

                    <button
                        onClick={() => {
                            Actions.send_signal("SIGINT", store.get("gdb_pid"));
                        }}
                        type="button"
                        title="Send Interrupt signal (SIGINT) to gdb process to pause it (if it's running)"
                        className={btn_class}
                    >
                        <Pause size={13} />
                    </button>

                    <button
                        id="next_button"
                        onClick={() => GdbApi.click_next_button()}
                        type="button"
                        title={
                            "Step over next function call keyboard shortcut: n or right arrow" +
                            (this.state.reverse_supported
                                ? ". shift + n for reverse."
                                : "")
                        }
                        className={btn_class}
                    >
                        <StepForward size={13} />
                    </button>

                    <button
                        id="step_button"
                        onClick={() => GdbApi.click_step_button()}
                        type="button"
                        title={
                            "Step into next function call keyboard shortcut: s or down arrow" +
                            (this.state.reverse_supported
                                ? ". shift + s for reverse."
                                : "")
                        }
                        className={btn_class}
                    >
                        <ArrowDown size={13} />
                    </button>

                    <button
                        id="return_button"
                        onClick={() => GdbApi.click_return_button()}
                        type="button"
                        title="Step out of current function keyboard shortcut: u or up arrow"
                        className={btn_class}
                    >
                        <ArrowUp size={13} />
                    </button>
                    <button
                        id="next_instruction_button"
                        onClick={() => GdbApi.click_next_instruction_button()}
                        type="button"
                        title={
                            "Next Instruction: Execute one machine instruction, stepping over function calls keyboard shortcut: m" +
                            (this.state.reverse_supported
                                ? ". shift + m for reverse."
                                : "")
                        }
                        className={btn_class}
                    >
                        NI
                    </button>
                    <button
                        id="step_instruction_button"
                        onClick={() => GdbApi.click_step_instruction_button()}
                        type="button"
                        title={
                            "Step Instruction: Execute one machine instruction, stepping into function calls keyboard shortcut: ','" +
                            (this.state.reverse_supported
                                ? ". shift + , for reverse."
                                : "")
                        }
                        className={btn_class}
                    >
                        SI
                    </button>
                    <label
                        title={
                            "when clicking buttons to the right, pass the `--reverse` " +
                            "flag to gdb in an attempt to debug in reverse. This is not always supported. " +
                            "rr is known to support reverse debugging. Keyboard shortcuts go in " +
                            "reverse when pressed with the shift key."
                        }
                        className="h-full gap-2"
                        style={{ margin: 0 }}
                    >
                        <input
                            type="checkbox"
                            disabled={!this.state.reverse_supported}
                            checked={store.get("debug_in_reverse")}
                            onChange={(e) => {
                                store.set("debug_in_reverse", e.target.checked);
                            }}
                        />
                        <span className="h-full">reverse</span>
                    </label>
                </div>
            </div>
        );
    }
}

export default ControlButtons;
