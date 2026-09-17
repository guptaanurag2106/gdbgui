import React from "react";

type ReactTableProps = {
    data: any[];
    header?: string[];
    style?: React.CSSProperties;
};

class ReactTable extends React.Component<ReactTableProps> {
    static defaultProps = { header: [], style: {} };

    render() {
        const header = this.props.header ?? [];
        const { data, style } = this.props;
        return (
            <table className="w-full border-collapse" style={style}>
                {header.length > 0 && (
                    <thead>
                        <tr>
                            {header.map((col: string, i: number) => (
                                <th
                                    key={i}
                                    className="text-left px-1.5 py-0.5 border-b border-[var(--border)] text-[var(--muted)] font-bold whitespace-nowrap"
                                >
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                )}
                <tbody>
                    {data.map((row: any, i: number) => (
                        <tr key={i} className="group">
                            {(Array.isArray(row) ? row : [row]).map(
                                (cell: any, j: number) => (
                                    <td
                                        key={j}
                                        className="px-1.5 py-0.5 border-b border-[var(--border)] text-[var(--fg)] align-top group-hover:bg-[var(--hover)]"
                                    >
                                        {cell}
                                    </td>
                                ),
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }
}

export default ReactTable;
