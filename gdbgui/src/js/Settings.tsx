import { store } from "statorgfc";
import Actions from "./Actions";
import ToolTip from "./ToolTip";
import React from "react";
import { toggle_config_key, update_config_key } from "./Config";
import { ChevronDown, X } from "lucide-react";

/**
 * Settings modal when clicking the gear icon
 */
class Settings extends React.Component {
    max_source_file_lines_input: any;
    save_button: any;
    settings_node: any;
    constructor(props: {}) {
        super(props);
        store.connectComponentState(this, [
            "debug",
            "theme",
            "themes",
            "gdb_version",
            "gdb_pid",
            "show_settings",
            "auto_add_breakpoint_to_main",
            "pretty_print",
            "refresh_state_after_sending_console_command",
            "show_all_sent_commands_in_console",
            "highlight_source_code",
        ]);
        this.get_update_max_lines_of_code_to_fetch =
            this.get_update_max_lines_of_code_to_fetch.bind(this);
    }
    static get_checkbox_row(store_key: any, text: any) {
        return (
            <label className="flex cursor-pointer items-start gap-2 py-1">
                <input
                    className="mt-1 accent-[var(--accent)]"
                    type="checkbox"
                    checked={store.get(store_key)}
                    onChange={() => toggle_config_key(store_key)}
                />
                <span>{text}</span>
            </label>
        );
    }
    get_update_max_lines_of_code_to_fetch() {
        return (
            <div className="flex flex-wrap items-center gap-2 py-1">
                <label htmlFor="max-source-file-lines">
                    Maximum number of source file lines to display:
                </label>
                <input
                    id="max-source-file-lines"
                    className="w-24 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[var(--fg)]"
                    defaultValue={store.get("max_lines_of_code_to_fetch")}
                    ref={(el) => (this.max_source_file_lines_input = el)}
                />
                <button
                    className="rounded border border-[var(--border)] bg-[var(--hover)] px-2 py-1 text-[var(--fg)] hover:bg-[var(--accent)] hover:text-white"
                    ref={(n) => (this.save_button = n)}
                    onClick={() => {
                        let new_value = parseInt(
                            this.max_source_file_lines_input.value,
                        );
                        Actions.update_max_lines_of_code_to_fetch(new_value);
                        ToolTip.show_tooltip_on_node(
                            "saved!",
                            this.save_button,
                            1,
                        );
                    }}
                >
                    save
                </button>
            </div>
        );
    }
    get_table() {
        return (
            <div className="space-y-1">
                {Settings.get_checkbox_row(
                    "auto_add_breakpoint_to_main",
                    "Add breakpoint to main after loading executable",
                )}
                {this.get_update_max_lines_of_code_to_fetch()}
                {Settings.get_checkbox_row(
                    "pretty_print",
                    "Pretty print dynamic variables (requires restart)",
                )}
                {Settings.get_checkbox_row(
                    "refresh_state_after_sending_console_command",
                    "Refresh all components when a command is sent from the console",
                )}
                {Settings.get_checkbox_row(
                    "show_all_sent_commands_in_console",
                    "Print all sent commands in console, including those sent automatically by gdbgui",
                )}
                {Settings.get_checkbox_row(
                    "highlight_source_code",
                    "Add syntax highlighting to source files",
                )}

                <div className="py-1">
                    <label className="flex flex-wrap items-center gap-2 py-1">
                        <span>Theme:</span>
                        <span className="relative inline-block">
                            <select
                                className="appearance-none rounded border border-[var(--border)] bg-[var(--bg)] py-1 pl-2 pr-8 text-[var(--fg)] outline-none focus:border-[var(--accent)]"
                                value={store.get("theme")}
                                onChange={function (e) {
                                    const theme = e.currentTarget.value;
                                    store.set("theme", theme);
                                    update_config_key("theme", theme);
                                    const link_tag = document.getElementById(
                                        "pygments-theme",
                                    ) as HTMLLinkElement | null;
                                    if (link_tag)
                                        link_tag.href = `/static/vendor/css/pygments/${theme}.css`;
                                }}
                            >
                                {store.get("themes").map((t: any) => (
                                    <option key={t}>{t}</option>
                                ))}
                            </select>
                            <span className="pointer pointer-events-none absolute inset-y-0 right-2 flex items-center text-[var(--accent)]">
                                <ChevronDown size={14} className="inline" />
                            </span>
                        </span>
                    </label>
                </div>
            </div>
        );
    }

    //TODO:why is this not a Modal
    render() {
        return (
            <div
                className={
                    store.get("show_settings")
                        ? "fixed inset-0 z-[120] overflow-auto bg-black/80 p-2.5"
                        : "hidden"
                }
                ref={(el) => (this.settings_node = el)}
                onClick={(e) => {
                    if (e.target === this.settings_node) {
                        store.set("show_settings", !store.get("show_settings"));
                    }
                }}
            >
                <div className="mx-auto max-h-[85%] w-full max-w-[800px] overflow-auto rounded border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--fg)] shadow-xl sm:p-10">
                    <button
                        className="float-right text-2xl leading-none text-[var(--muted)] hover:text-[var(--fg)]"
                        onClick={() => store.set("show_settings", false)}
                    >
                        <X size={18} className="inline" />
                    </button>
                    <h4 className="mb-4 text-lg font-semibold">Settings</h4>
                    {this.get_table()}
                    <div className="mt-5 flex justify-end border-t border-[var(--border)] pt-4">
                        <button
                            className="rounded bg-[var(--accent)] px-3 py-2 font-medium hover:opacity-90"
                            style={{ color: "var(--bg)" }}
                            onClick={() => store.set("show_settings", false)}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}

export default Settings;
