import React from "react";
import ReactTable from "./ReactTable";
import { store } from "statorgfc";

import { base_style, badge_style } from "./styles";
import { FileLink } from "./Links";
import GdbApi from "./GdbApi";
import Memory from "./Memory";
import { MemoryLink } from "./Links";

type FrameArgumentsProps = {
    args: GdbFrameArg[] | undefined;
};

class FrameArguments extends React.Component<FrameArgumentsProps> {
    render_frame_arg(frame_arg: GdbFrameArg) {
        return [
            frame_arg.name,
            Memory.make_addrs_into_links_react(frame_arg.value),
        ];
    }

    render() {
        let frame_args = this.props.args ?? [];
        return (
            <ReactTable
                data={frame_args.map(this.render_frame_arg)}
                style={{
                    fontSize: "14px",
                    borderWidth: "0",
                    margin: "0",
                    borderCollapse: "collapse",
                }}
            />
        );
    }
}

type ThreadsState = {
    threads: GdbThread[];
    thread_ids: string[] | undefined;
    current_thread_id: number | undefined;
    stack: GdbFrame[];
    selected_frame_num: number;
};
class Threads extends React.Component<{}, ThreadsState> {
    thread_data: Record<string, GdbFrame[]> = {}; // per thread table of func, file, addr, args
    constructor(props: {}) {
        super(props);
        store.connectComponentState(this, [
            "threads",
            "thread_ids",
            "current_thread_id",
            "stack",
            "selected_frame_num",
        ]);
    }

    static select_thread_id(thread_id: string) {
        GdbApi.select_thread_id(thread_id);
    }

    static select_frame(framenum: number) {
        store.set("selected_frame_num", framenum);
        store.set("line_of_source_to_flash", null);
        store.set("make_current_line_visible", true);
        GdbApi.select_frame(framenum);
    }

    update_thread_data(thread: GdbThread) {
        let thread_id = thread.id;
        if (parseInt(thread_id) === this.state.current_thread_id) {
            let stack = this.get_current_thread_stack(thread);
            if (stack) {
                this.thread_data[thread_id] = stack;
            } else if (!this.thread_data[thread_id] && thread.frame) {
                this.thread_data[thread_id] = [thread.frame];
            }
        } else if (!this.thread_data[thread_id] && thread.frame) {
            this.thread_data[thread_id] = [thread.frame];
        }
    }

    get_current_thread_stack(thread: GdbThread): GdbFrame[] | null {
        if (!thread.frame || !Array.isArray(this.state.stack)) {
            return null;
        }

        let current_frame_index = -1;
        for (let i = 0; i < this.state.stack.length; i++) {
            if (
                this.state.stack[i] &&
                this.state.stack[i].addr === thread.frame.addr
            ) {
                current_frame_index = i;
                break;
            }
        }

        if (current_frame_index === -1) {
            return null;
        }

        let previous_stack = this.thread_data[thread.id] || [];
        let stack = this.state.stack.map((frame: GdbFrame): GdbFrame => {
            let previous_frame = Threads.get_matching_previous_frame(
                frame,
                previous_stack,
            );
            return Object.assign(
                {},
                frame,
                previous_frame && previous_frame.args
                    ? {
                          args: previous_frame.args,
                      }
                    : {},
            );
        });
        stack[current_frame_index] = Object.assign(
            {},
            stack[current_frame_index],
            {
                args: thread.frame.args,
            },
        );
        return stack;
    }

    static get_matching_previous_frame(
        frame: GdbFrame,
        previous_stack: GdbFrame[],
    ): GdbFrame | null {
        for (let previous_frame of previous_stack) {
            if (previous_frame && previous_frame.addr === frame.addr) {
                return previous_frame;
            }
        }
        for (let previous_frame of previous_stack) {
            if (
                previous_frame &&
                previous_frame.func === frame.func &&
                previous_frame.fullname === frame.fullname
            ) {
                return previous_frame;
            }
        }
        return null;
    }

    static get_thread_header(
        thread: GdbThread,
        is_current_thread_being_rendered: boolean,
    ) {
        let selected;
        if (is_current_thread_being_rendered) {
            selected = <span className={badge_style}>selected</span>;
        } else {
            selected = (
                <button
                    className="btn cursor-pointer px-1 py-px text-[11px]"
                    onClick={() => {
                        Threads.select_thread_id(thread.id);
                    }}
                    title="Select this thread"
                >
                    select
                </button>
            );
        }
        const details = Memory.make_addrs_into_links_react(thread["target-id"]);
        const core = thread.core ? `, core ${thread.core}` : "";
        const state = ", " + thread.state;
        const id = ", id " + thread.id;
        const name = thread.name ? `, ${thread.name}` : "";
        return (
            <span
                key={"thread" + thread.id}
                className={`text-[var(--fg)] ${is_current_thread_being_rendered ? "font-bold" : ""}`}
            >
                {selected} {details}
                {id}
                {core}
                {state}
                {name}
            </span>
        );
    }

    static get_frame_row(
        frame: GdbFrame,
        is_selected_frame: boolean,
        thread_id: string,
        is_current_thread_being_rendered: boolean,
        frame_num: number,
    ) {
        let onclick;
        let title;

        if (is_selected_frame) {
            onclick = () => {};
            title = `this is the active frame of the selected thread (frame id ${frame_num})`;
        } else if (is_current_thread_being_rendered) {
            onclick = () => {
                Threads.select_frame(frame_num);
            };
            title = `click to select this frame (frame id ${frame_num})`;
        } else {
            onclick = () => {
                Threads.select_thread_id(thread_id);
            };
            title = `click to select this thead (thread id ${thread_id})`;
        }
        let key = thread_id + frame_num;

        return [
            <span
                key={key}
                title={title}
                className={`text-[var(--fg)] ${is_selected_frame ? "font-bold" : ""} cursor-pointer`}
                onClick={onclick}
            >
                {frame.func}
            </span>,
            <FileLink
                fullname={frame.fullname}
                file={frame.file}
                line={frame.line}
            />,
            <MemoryLink addr={frame.addr} />,
            <FrameArguments args={frame.args} />,
        ];
    }

    static get_row_data_for_stack(
        stack: GdbFrame[],
        selected_frame_num: number,
        thread_id: string,
        is_current_thread_being_rendered: boolean,
    ) {
        let row_data = [];
        let frame_num = 0;
        for (let frame of stack) {
            let is_selected_frame =
                selected_frame_num === frame_num &&
                is_current_thread_being_rendered;
            row_data.push(
                Threads.get_frame_row(
                    frame || {},
                    is_selected_frame,
                    thread_id,
                    is_current_thread_being_rendered,
                    frame_num,
                ),
            );
            frame_num++;
        }

        if (stack.length === 0) {
            row_data.push(["unknown", "unknown", "unknown"]);
        }
        return row_data;
    }

    static update_stack(stack: GdbFrame[]) {
        store.set("stack", stack);
        store.set(
            "paused_on_frame",
            stack[store.get("selected_frame_num") || 0],
        );
        store.set(
            "fullname_to_render",
            store.get("paused_on_frame")
                ? store.get("paused_on_frame").fullname
                : {},
        );
        store.set(
            "line_of_source_to_flash",
            parseInt(store.get("paused_on_frame").line),
        );
        store.set(
            "current_assembly_address",
            store.get("paused_on_frame").addr,
        );
        store.set("make_current_line_visible", true);
    }

    static update_thread_ids(thread_id: string | string[]) {
        if (typeof thread_id == "string") {
            store.set("thread_ids", [thread_id]);
        } else {
            store.set("thread_ids", thread_id);
        }
    }
    set_thread_id(id: string) {
        store.set("current_thread_id", parseInt(id));
    }

    render() {
        if (this.state.threads.length <= 0) {
            this.thread_data = {};
            return null;
        }

        let thread_ids =
            this.state.thread_ids || this.state.threads.map((t) => t.id);
        for (let thread_id of Object.keys(this.thread_data)) {
            if (thread_ids.indexOf(thread_id) === -1) {
                delete this.thread_data[thread_id];
            }
        }

        for (let thread_id of thread_ids) {
            for (let thread of this.state.threads) {
                if (thread.id === thread_id) {
                    this.update_thread_data(thread);
                    break;
                }
            }
        }

        let content = [];
        for (let thread of this.state.threads) {
            let is_current_thread_being_rendered =
                parseInt(thread.id) === this.state.current_thread_id;
            let stack = this.thread_data[thread.id];
            if (!stack) {
                continue;
            }
            let row_data;
            try {
                row_data = Threads.get_row_data_for_stack(
                    stack,
                    this.state.selected_frame_num,
                    thread.id,
                    is_current_thread_being_rendered,
                );
            } catch (err) {
                row_data = ["unknown", "unknown", "unknown"];
                console.log(err);
            }

            content.push(
                Threads.get_thread_header(
                    thread,
                    is_current_thread_being_rendered,
                ),
            );

            content.push(
                <ReactTable
                    data={row_data}
                    style={{
                        ...base_style,
                        marginBottom: 0,
                        borderCollapse: "collapse",
                    }}
                    key={thread.id}
                    header={["func", "file", "addr", "args"]}
                />,
            );
        }
        return <div>{content}</div>;
    }
}

export default Threads;
