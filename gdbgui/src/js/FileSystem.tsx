import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

type FileSystemProps = {
    rootnode: any;
    onToggle: (node: any) => void;
    onClickName: (node: any) => void;
};

class FileSystem extends React.Component<FileSystemProps, {}> {
    nodecount: any;
    get_node_jsx(node: any, depth = 0) {
        if (!node) {
            return null;
        }
        this.nodecount++;

        let get_child_jsx_for_node = (node: any) => {
            if (!(node.children && node.toggled)) {
                return null;
            }
            return (
                <ul>
                    {node.children.map((child: any) =>
                        this.get_node_jsx(child, depth + 1),
                    )}
                </ul>
            );
        };
        let indent = "\u00A0\u00A0\u00A0".repeat(depth);
        let is_file = !node.children,
            is_dir = !is_file;

        let onClickName = null;
        if (is_file) {
            onClickName = () => {
                this.props.onClickName(node);
            };
        }

        return (
            <React.Fragment key={this.nodecount}>
                <li className="pointer py-0.5">
                    {indent}
                    {is_dir && (
                        <span
                            className="mr-1 text-[var(--muted)]"
                            onClick={() => this.props.onToggle(node)}
                        >
                            {node.toggled ? (
                                <ChevronDown size={14} className="inline" />
                            ) : (
                                <ChevronRight size={14} className="inline" />
                            )}
                        </span>
                    )}
                    {/* @ts-expect-error ts-migrate(2322) FIXME: Type 'null' is not assignable to type '((event: Mo... Remove this comment to see the full error message */}
                    <span onClick={onClickName}>{node.name}</span>
                </li>
                {get_child_jsx_for_node(node)}
            </React.Fragment>
        );
    }

    render() {
        this.nodecount = -1;
        return (
            <div className="text-[var(--fg)]">
                <ul>{this.get_node_jsx(this.props.rootnode)}</ul>
            </div>
        );
    }
}

export default FileSystem;
