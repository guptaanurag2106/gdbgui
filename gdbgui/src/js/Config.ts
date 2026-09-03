/* global initial_data */
/* global debug */
import { store } from "statorgfc";
import constants from "./constants";
import Util from "./Util";

/**
 * The initial store data. Keys cannot be added after initialization.
 * All fields in here should be shared by > 1 component, otherwise they should
 * exist as local state for that component.
 */
const initial_store_data = {
  // environment
  debug: debug, // if gdbgui is run in debug mode
  gdbgui_version: initial_data.gdbgui_version,
  latest_gdbgui_version: "(not fetched)",
  gdb_version: "unknown", // this is parsed from gdb's output
  gdb_version_array: [], // this is parsed from gdb's output
  gdb_pid: undefined,
  gdb_command: initial_data.gdb_command,
  can_fetch_register_values: true, // set to false if using Rust and gdb v7.12.x (see https://github.com/cs01/gdbgui/issues/64)
  show_settings: false,

  features: { features: [], target_features: [] }, // stores both cmd features and target features

  debug_in_reverse: false,
  reverse_supported: false,
  show_modal: false,
  modal_header: null,
  modal_body: null,

  show_tour_guide: false,
  tour_guide_step: 0,
  num_tour_guide_steps: 0,
  tooltip: { hidden: false, content: "placeholder", node: null, show_for_n_sec: null },
  textarea_to_copy_to_clipboard: {}, // will be replaced with textarea dom node

  // preferences
  themes: initial_data.themes,
  theme: initial_data.themes[0],
  highlight_source_code: true, // get saved boolean to highlight source code
  max_lines_of_code_to_fetch: constants.default_max_lines_of_code_to_fetch,
  auto_add_breakpoint_to_main: true,

  pretty_print: true, // whether gdb should "pretty print" variables. There is an option for this in Settings
  refresh_state_after_sending_console_command: true, // If true, send commands to refresh GUI store after each command is sent from console
  show_all_sent_commands_in_console: debug, // show all sent commands if in debug mode

  inferior_program: constants.inferior_states.unknown,
  inferior_pid: null,

  paused_on_frame: undefined,
  selected_frame_num: 0,
  thread_ids: undefined,
  current_thread_id: undefined,
  stack: [],
  locals: [],
  threads: [],

  // source files
  source_file_paths: [], // all the paths gdb says were used to compile the target binary
  language: "c_family", // assume langage of program is c or c++. Language is determined by source file paths. Used to turn on/off certain features/warnings.
  files_being_fetched: [],
  fullname_to_render: null,
  line_of_source_to_flash: null,
  current_assembly_address: null,
  // rendered_source: {},
  make_current_line_visible: false, // set to true when source code window should jump to current line
  cached_source_files: [], // list with keys fullname, source_code
  disassembly_for_missing_file: [], // mi response object. Only fetched when there currently paused frame refers to a file that doesn't exist or is undefined
  show_inline_disassembly: true, // show/hide disassembly (additional button) when source_file is available and disassembly is fetched once
  missing_files: [], // files that were attempted to be fetched but did not exist on the local filesystem
  source_code_state: constants.source_code_states.NONE_AVAILABLE,
  source_code_selection_state: constants.source_code_selection_states.PAUSED_FRAME,

  source_code_infinite_scrolling: false,
  source_linenum_to_display_start: 0,
  source_linenum_to_display_end: 0,

  // binary selection
  inferior_binary_path: null,
  inferior_binary_path_last_modified_unix_sec: null,

  // registers
  register_names: [],
  previous_register_values: [],
  current_register_values: [],

  // memory
  memory_cache: {},
  start_addr: "",
  end_addr: "",
  bytes_per_line: "8",

  // breakpoints
  breakpoints: [],

  // expressions
  expressions: [], // array of dicts. Key is expression, value has various keys. See Expressions component.
  root_gdb_tree_var: null, // draw tree for this variable

  waiting_for_response: false,

  gdb_mi_output: [],

  gdb_autocomplete_options: [],

  gdb_console_entries: [],

  // if we try to write something before the websocket is connected, store it here
  queuedGdbCommands: [],

  show_filesystem: true,
  middle_sizes: [30, 40, 29] as number[],
  gdbguiPty: null,

  past_binaries: new Set()
};

export async function load_config() {
  await Util.get_json<Record<any, unknown>>("/config")
    .then(data => {
      for (const [key, value] of Object.entries(data)) {
        // @ts-expect-error TS7053: Element implicitly has an 'any' type because expression of type 'any' can't be used to index type '{ debug: boolean; gdbgui_version: string; latest_gdbgui_version: string; gdb_version: string; gdb_version_array: never[]; gdb_pid: undefined; gdb_command: string; can_fetch_register_values: boolean; ... 65 more ...; past_binaries: Set<...>; }'.
        initial_store_data[key as any] = value;
      }
    })
    .catch(err => console.log("Error fetching /config endpoint, using defaults", err));
}

export function update_config_key(key: string, value: unknown) {
  Util.post_json("/config", { key, value })
    .then(data => {
      console.log(data);
    })
    .catch(err =>
      console.log("Error updating /config endpoint for ", key, ":", value, " ", err)
    );
}

export function toggle_config_key(key: string) {
  const val = store.get(key);
  store.set(key, !val);
  update_config_key(key, !val);
}

export default initial_store_data;
