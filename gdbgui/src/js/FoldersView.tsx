import React from "react";
import { store } from "statorgfc";
import FileOps from "./FileOps";
import constants from "./constants";
import SourceFileAutocomplete from "./SourceFileAutocomplete";
import FileSystem from "./FileSystem";
import Actions from "./Actions";
import { btn_style } from "./styles";

const default_rootnode = {
    name: 'Load inferior program, then click "Fetch source files" to populate this window',
    children: [],
    toggled: false,
};

function get_child_node_with_name(name: any, curnode: any) {
    if (!curnode.children) {
        return null;
    }
    for (let node of curnode.children) {
        if (node.name === name) {
            return node;
        }
    }
    return null;
}

type State = any;

class FoldersView extends React.Component<{}, State> {
    max_filesystem_entries: any;
    project_home: any;
    constructor(props: {}) {
        super(props);
        this.state = {
            rootnode: default_rootnode,
        };
        store.connectComponentState(
            this,
            ["source_code_state", "source_file_paths", "inferior_program"],
            this.update_filesystem_data.bind(this),
        );

        this.max_filesystem_entries = 300;
        this.project_home = initial_data.project_home; /* global initial_data */
        this.onToggle = this.onToggle.bind(this);
        this.onClickName = this.onClickName.bind(this);
        this.reveal_path = this.reveal_path.bind(this);
        this.expand_all = this.expand_all.bind(this);
        this.collapse_all = this.collapse_all.bind(this);
    }

    render() {
        let source_code_state = this.state.source_code_state,
            file_is_rendered =
                source_code_state ===
                    constants.source_code_states.SOURCE_CACHED ||
                source_code_state ===
                    constants.source_code_states.ASSM_AND_SOURCE_CACHED,
            can_reveal =
                file_is_rendered && this.state.source_file_paths.length,
            hiding_entries =
                this.state.source_file_paths.length >
                this.max_filesystem_entries,
            has_files =
                Array.isArray(this.state.source_file_paths) &&
                this.state.source_file_paths.length > 0,
            binary_loaded =
                (this.state.inferior_program ||
                    constants.inferior_states.unknown) !==
                constants.inferior_states.unknown,
            folder_btn_style = (disabled: boolean): React.CSSProperties => ({
                ...btn_style,
                ...(disabled
                    ? {
                          backgroundColor: "var(--hover)",
                          color: "var(--muted)",
                          cursor: "not-allowed" as const,
                      }
                    : {}),
            });

        return (
            <div className="flex flex-col gap-2 text-[var(--fg)] bg-[var(--topbar-bg)] overflow-y-auto h-full">
                <button
                    className="inline-flex h-7 items-center px-2 py-1 hover:opacity-90"
                    style={folder_btn_style(!binary_loaded)}
                    disabled={!binary_loaded}
                    onClick={Actions.fetch_source_files}
                >
                    Fetch source files
                </button>

                <SourceFileAutocomplete
                    file_paths={this.state.source_file_paths}
                    disabled={!has_files}
                />

                <div className="flex flex-wrap gap-1">
                    <button
                        className="inline-flex h-7 items-center px-2 py-1 hover:opacity-90"
                        style={folder_btn_style(!has_files)}
                        disabled={!has_files}
                        onClick={this.expand_all}
                    >
                        Expand all
                    </button>
                    <button
                        className="inline-flex h-7 items-center px-2 py-1 hover:opacity-90"
                        style={folder_btn_style(!has_files)}
                        disabled={!has_files}
                        onClick={this.collapse_all}
                    >
                        Collapse all
                    </button>
                    {can_reveal && (
                        //TODO:button does what??
                        <button
                            className="inline-flex h-7 items-center px-2 py-1 hover:opacity-90"
                            style={btn_style}
                            onClick={() =>
                                this.reveal_path(
                                    store.get("fullname_to_render"),
                                )
                            }
                        >
                            Reveal current file
                        </button>
                    )}
                </div>

                {store.get("source_file_paths").length > 0 && (
                    <p style={{ color: "var(--muted)" }}>
                        {store.get("source_file_paths").length} known files used
                        to compile the inferior program
                    </p>
                )}

                {hiding_entries && (
                    <p
                        style={{
                            backgroundColor: "var(--accent-2)",
                            color: "var(--bg)",
                            padding: "4px",
                        }}
                    >
                        Maximum entries in tree below is{" "}
                        {this.max_filesystem_entries} (hiding{" "}
                        {store.get("source_file_paths").length -
                            this.max_filesystem_entries}
                        ). All files can still be searched for in the input
                        above.
                    </p>
                )}

                <FileSystem
                    rootnode={this.state.rootnode}
                    onToggle={this.onToggle}
                    onClickName={this.onClickName}
                />
            </div>
        );
    }
    onClickName(node: any) {
        let curnode = node,
            path = [];
        while (curnode) {
            if (curnode.name === "root") {
                path.unshift("");
                break;
            }
            path.unshift(curnode.name);
            curnode = curnode.parent;
        }
        if (path.length) {
            FileOps.user_select_file_to_view(path.join("/"), 1);
        }
    }
    reveal_path(path: any) {
        if (!path) {
            return;
        }

        if (this.state.cursor) {
            this.state.cursor.active = false;
        }

        if (this.project_home) {
            path = path.replace(this.project_home, "");
        }

        let names = path.split("/").filter((n: any) => n !== ""),
            curnode = this.state.rootnode;

        curnode.toggled = true;
        for (let name of names) {
            curnode = get_child_node_with_name(name, curnode);
            if (curnode) {
                curnode.toggled = true;
            } else {
                break;
            }
        }

        if (curnode) {
            curnode.active = true;
        }
        this.setState({ rootnode: this.state.rootnode, cursor: curnode });
    }
    update_filesystem_data(keys: any) {
        if (keys.indexOf("source_file_paths") === -1) {
            return;
        }

        let source_paths = this.state.source_file_paths;
        if (!Array.isArray(source_paths) || !source_paths.length) {
            this.setState({
                rootnode: default_rootnode,
            });
            return;
        }

        let rootnode = {
            name: this.project_home || "root",
            toggled: true,
            children: [],
        };

        let relative_source_paths = source_paths;

        if (this.project_home) {
            let project_home = this.project_home;
            relative_source_paths = source_paths
                .filter((p) => p.startsWith(project_home))
                .map((p) => {
                    p = p.replace(project_home, "");
                    return p;
                });
        }
        for (let path of relative_source_paths) {
            let depth = 0;
            let new_node,
                names = path.split("/").filter((n: any) => n !== ""),
                curnode = rootnode,
                toggled = depth === 0;
            for (let name of names) {
                let child = get_child_node_with_name(name, curnode);
                if (child) {
                    curnode = child;
                } else {
                    new_node = {
                        name: name,
                        toggled: toggled,
                        // @ts-expect-error  error TS2353
                        parent: curnode,
                    };
                    if (curnode.children) {
                        // @ts-expect-error ts-migrate(2345)
                        curnode.children.push(new_node);
                    } else {
                        // @ts-expect-error ts-migrate(2322)
                        curnode.children = [new_node];
                    }
                    curnode = new_node;
                }

                depth++;
            }
        }
        this.setState({ rootnode: rootnode });
    }

    onToggle(node: any) {
        node.toggled = !node.toggled;
        this.setState({ rootnode: this.state.rootnode });
    }
    expand_all() {
        let callback = (node: any) => {
            node.toggled = true;
        };
        for (let top_level_child of this.state.rootnode.children) {
            this._dfs(top_level_child, callback);
        }
        this.setState({ rootnode: this.state.rootnode });
    }
    collapse_all() {
        let callback = (node: any) => {
            node.toggled = false;
        };
        for (let top_level_child of this.state.rootnode.children) {
            this._dfs(top_level_child, callback);
        }
        this.setState({ rootnode: this.state.rootnode });
    }
    _dfs(node: any, callback: any) {
        callback(node);
        if (node.children) {
            for (let child of node.children) {
                this._dfs(child, callback);
            }
        }
    }
}

export default FoldersView;
