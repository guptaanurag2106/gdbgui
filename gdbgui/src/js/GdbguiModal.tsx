import React from "react";
import Actions from "./Actions";
import { store } from "statorgfc";
import { X } from "lucide-react";

type State = any;

class Modal extends React.Component<{}, State> {
    fullscreen_node: any;
    constructor(props: {}) {
        super(props);
        store.connectComponentState(this, [
            "show_modal",
            "modal_body",
            "modal_header",
        ]);
    }
    render() {
        return (
            <div
                className={
                    this.state.show_modal
                        ? "fixed inset-0 z-[120] overflow-auto bg-black/80 p-2.5"
                        : "hidden"
                }
                ref={(el) => (this.fullscreen_node = el)}
                onClick={(e) => {
                    if (e.target === this.fullscreen_node) {
                        Actions.toggle_modal_visibility();
                    }
                }}
            >
                <div className="mx-auto w-full max-w-[500px] rounded border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--fg)] shadow-xl">
                    <div className="flex justify-end">
                        <button
                            type="button"
                            className="text-2xl leading-none text-[var(--muted)] hover:text-[var(--fg)]"
                            onClick={Actions.toggle_modal_visibility}
                        >
                            <X size={18} className="inline" />
                        </button>
                    </div>

                    <h4 className="mb-4 text-lg font-semibold">
                        {this.state.modal_header}
                    </h4>

                    <div className="pb-5">{this.state.modal_body}</div>

                    <div className="flex justify-end border-t border-[var(--border)] pt-4">
                        <button
                            type="button"
                            className="rounded bg-[var(--accent)] px-3 py-2 font-medium hover:opacity-90"
                            style={{ color: "var(--bg)" }}
                            onClick={Actions.toggle_modal_visibility}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}

export default Modal;
