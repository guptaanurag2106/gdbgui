declare module "statorgfc" {
  export let store: {
    get(key: string): any;
    set(key: string, value: any): any;

    // using inline import to avoid breaking global scope
    connectComponentState<P = {}, S = {}>(
      component: import("react").Component<P, S>,
      keys_to_watch_for_change: string[],
      addition_callback?: (...args: any[]) => any
    ): void;
  };
  export let middleware: {
    logChanges(key: string, oldval: any, newval: any): bool;
  };
}

declare var initial_data: {
  gdbgui_version: string;
  gdbpid: number;
  gdb_command: string;
  initial_binary_and_args: string[];
  project_home: string | null;
  remap_sources: any;
  themes: string[];
  signals: any;
  using_windows: boolean;
};
declare var debug: boolean;
