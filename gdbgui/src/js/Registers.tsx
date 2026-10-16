/**
 * A component to display, fetch, and store register
 */

import React from "react";
import { store } from "statorgfc";

import CompletionDropdown from "./CompletionDropdown";
import constants from "./constants";
import GdbApi from "./GdbApi";
import Memory from "./Memory";
import ReactTable from "./ReactTable";
import register_descriptions from "./register_descriptions";

const MAX_REGISTER_NAME_FETCH_COUNT = 5;
let register_name_fetch_count = 0,
    register_name_fetch_timeout: any = null;

type RegistersState = any;

class Registers extends React.Component<{}, RegistersState> {
    constructor(props: {}) {
        super(props);
        store.connectComponentState(this, [
            "inferior_program_state",
            "register_names",
            "register_radix",
            "can_fetch_register_values",
            "previous_register_values",
            "current_register_values",
        ]);
    }

    static clear_cached_values() {
        store.set("previous_register_values", []);
        store.set("current_register_values", []);
    }

    static get_update_cmds() {
        let cmds: string[] = [];
        if (
            [
                constants.inferior_states.paused,
                constants.inferior_states.running,
            ].indexOf(store.get("inferior_program_state")) == -1
        ) {
            return cmds;
        }

        if (store.get("can_fetch_register_values") === true) {
            if (store.get("register_names").length === 0) {
                if (
                    register_name_fetch_count <= MAX_REGISTER_NAME_FETCH_COUNT
                ) {
                    clearTimeout(register_name_fetch_timeout);
                    register_name_fetch_count++;
                    // only fetch register names when we don't have them
                    // assumption is that the names don't change over time
                    cmds.push(
                        constants.IGNORE_ERRORS_TOKEN_STR +
                            "-data-list-register-names",
                    );
                } else {
                    register_name_fetch_timeout = setTimeout(() => {
                        register_name_fetch_count--;
                    }, 5000);
                }
            }

            // update all registers values
            cmds.push(
                constants.IGNORE_ERRORS_TOKEN_STR +
                    "-data-list-register-values " +
                    store.get("register_radix"),
            );
        } else {
            Registers.clear_cached_values();
        }

        return cmds;
    }

    static clear_register_name_cache() {
        store.set("register_names", []);
    }

    static refetch() {
        Registers.clear_register_name_cache();
        Registers.clear_cached_values();
        GdbApi.run_gdb_command(Registers.get_update_cmds());
    }

    render() {
        let num_register_names = store.get("register_names").length,
            num_register_values = store.get("current_register_values").length;

        // TODO: if mi-async is on then will there be data on not paused?
        if (
            this.state.inferior_program_state !==
            constants.inferior_states.paused
        ) {
            return <span className="placeholder">no data to display</span>;
        }

        if (
            (num_register_names > 0 &&
                num_register_values > 0 &&
                num_register_names !== num_register_values) ||
            (num_register_names === 0 &&
                register_name_fetch_count <= MAX_REGISTER_NAME_FETCH_COUNT)
        ) {
            // Somehow register names and values do not match. Clear cached values, then refetch both.
            Registers.refetch();
        } else if (num_register_names === num_register_values) {
            let columns = ["name", "value"],
                register_table_data: string[][] = [],
                register_names = store.get("register_names"),
                register_values = store.get("current_register_values"),
                previous_register_values = store.get(
                    "previous_register_values",
                );

            // TODO: firstly register_names/register_values has rax, eax, al, ah everything can/should we unify them
            for (let i in register_names) {
                let name: string = register_names[i],
                    obj = register_values.find(
                        (v: RegisterValue) => v["number"] === i,
                    ),
                    hex_val_raw = "",
                    disp_val: string = "",
                    register_description = register_descriptions[name] || "",
                    changed = false;

                if (obj && obj.value) {
                    hex_val_raw = obj["value"];

                    let old_obj = previous_register_values.find(
                            (v: RegisterValue) => v["number"] === i,
                        ),
                        old_hex_val_raw = undefined;
                    if (old_obj) {
                        old_hex_val_raw = old_obj["value"];
                    }

                    // if the value changed, highlight it
                    if (
                        old_hex_val_raw !== undefined &&
                        hex_val_raw !== old_hex_val_raw
                    ) {
                        changed = true;
                    }

                    // if hex value is a valid value, convert it to a link
                    // and display decimal format too
                    disp_val = Memory.make_addrs_into_links_react(hex_val_raw);
                }

                const table_name = (
                    <span
                        title={register_description}
                        className={changed ? "highlight" : ""}
                    >
                        {name}
                    </span>
                );
                const table_disp_val = (
                    <span className={changed ? "highlight" : ""}>
                        {disp_val}
                    </span>
                );

                register_table_data.push([table_name, table_disp_val] as any[]);
            }

            return (
                <>
                    <CompletionDropdown
                        list={[
                            "hex",
                            "octal",
                            "binary",
                            "decimal",
                            "raw",
                            "natural",
                        ]}
                        placeholder="Select radix"
                        /* key={store.get("register_radix")} */
                        initial_value={
                            constants.radix_fmt_to_repr[
                                store.get("register_radix")
                            ]
                        }
                        onSelect={(val: string) => {
                            store.set(
                                "register_radix",
                                constants.radix_repr_to_fmt[val],
                            );
                            // clear old values as well otherwise it will always say changed
                            Registers.clear_cached_values();
                            GdbApi.run_gdb_command(Registers.get_update_cmds());
                        }}
                        show_all_on_empty
                        select_only
                    />
                    <ReactTable data={register_table_data} header={columns} />
                </>
            );
        }

        return <span className="placeholder">no data to display</span>;
    }
}

export default Registers;
