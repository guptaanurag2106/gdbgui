import React from "react";
import constants from "./constants";
import { store } from "statorgfc";
import { FileLink } from "./Links";
import FileOps from "./FileOps";
import Actions from "./Actions";
import { input_style } from "./styles";

type State = any;

class SourceCodeHeading extends React.Component<{}, State> {
    constructor(props: {}) {
        super(props);
        store.connectComponentState(this, [
            "fullname_to_render",
            "paused_on_frame",
            "line_of_source_to_flash",
            "source_code_selection_state",
        ]);
    }
    render() {
        if (!this.state.fullname_to_render) {
            return null;
        }

        let line;
        if (
            this.state.source_code_selection_state ===
                constants.source_code_selection_states.PAUSED_FRAME &&
            this.state.paused_on_frame
        ) {
            line = this.state.paused_on_frame.line;
        } else {
            line = this.state.line_of_source_to_flash;
        }

        let num_lines = 0;
        if (this.state.fullname_to_render) {
            //TODO:shouldn't need to check this should already be in cache when the fullname_to_render etc store values change
            const source_obj = FileOps.get_source_file_obj_from_cache(
                this.state.fullname_to_render,
            );
            if (source_obj) num_lines = source_obj.num_lines_in_file;
        }
        return (
            <div className="flex items-center gap-5">
                <FileLink
                    fullname={this.state.fullname_to_render}
                    file={this.state.fullname_to_render}
                    line={line}
                    num_lines={num_lines}
                />
                <input
                    autoComplete="off"
                    title="Enter line number, then press enter"
                    placeholder="jump to line"
                    style={input_style}
                    type="number"
                    onKeyUp={(e) => {
                        if (e.key === "Enter") {
                            Actions.set_line_state(
                                parseInt(e.currentTarget.value),
                            );
                        }
                    }}
                />
            </div>
        );
    }
}

export default SourceCodeHeading;
