export const base_style = { fontSize: "14px", color: "var(--fg)" };

export const btn_style = {
    backgroundColor: "var(--accent)",
    color: "var(--bg)",
    padding: "2px",
    fontSize: "14px",
    cursor: "pointer" as const,
    border: "none",
};

export const input_style = {
    display: "inline" as const,
    height: "25px",
    width: "75px",
    padding: "2px 4px",
    fontSize: "14px",
    border: "1px solid var(--border)",
    borderRadius: "3px",
    backgroundColor: "var(--bg)",
    color: "var(--fg)",
    outline: "none",
};

export const badge_style =
    "bg-[var(--accent)] text-[var(--bg)] px-1 py-px mr-1 text-[11px]";
