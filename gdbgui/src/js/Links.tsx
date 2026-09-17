import Actions from "./Actions";
import * as React from "react";
import CopyToClipboard from "./CopyToClipboard";
import Memory from "./Memory";

type OwnProps = {
    addr: string;
    style?: React.CSSProperties;
};

type MemoryLinkProps = OwnProps & typeof MemoryLink.defaultProps;

export class MemoryLink extends React.Component<MemoryLinkProps> {
    render() {
        // turn 0x00000000000000 into 0x0
        const address_no_leading_zeros =
            "0x" + parseInt(this.props.addr, 16).toString(16);
        return (
            <span
                className="pointer text-[var(--accent)]"
                onClick={() =>
                    Memory.set_inputs_from_address(address_no_leading_zeros)
                }
                title={`click to explore memory at ${address_no_leading_zeros}`}
                style={this.props.style}
            >
                {address_no_leading_zeros}
            </span>
        );
    }
    static defaultProps = { style: { fontFamily: "monospace" } };
}

type Props = {
    file: string;
    fullname: string;
    line: string;
    num_lines?: number;
};

export class FileLink extends React.Component<Props> {
    render() {
        let line = parseInt(this.props.line);
        if (!line) {
            line = 0;
        }
        let sep = "";
        if (line && line !== 0) {
            sep = ": ";
        }
        const onClick = () => Actions.view_file(this.props.fullname, line);

        const clipboard_content =
            (this.props.fullname || this.props.file) + sep + line;
        return (
            <div>
                <span
                    onClick={onClick}
                    className="pointer"
                    title={`click to view ${this.props.fullname}`}
                >
                    {this.props.file}
                    {sep}
                    {line > 0 ? `Ln ${line}` : ""}
                </span>

                <CopyToClipboard content={clipboard_content} />
                {this.props.num_lines ? ` (${this.props.num_lines} lines)` : ""}
            </div>
        );
    }
}

// type FrameLinkProps = {
//     addr: string;
//     file?: string;
//     fullname?: string;
//     line: string;
// };
//
// export class FrameLink extends React.Component<FrameLinkProps> {
//     render() {
//         return (
//             <div>
//                 <FileLink
//                     fullname={this.props.fullname}
//                     file={this.props.file}
//                     line={this.props.line}
//                 />
//                 <span style={{ whiteSpace: "pre" }}> </span>
//                 <MemoryLink addr={this.props.addr} />
//             </div>
//         );
//     }
// }
