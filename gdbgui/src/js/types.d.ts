declare module "statorgfc" {
    export let store: {
        initialize(initial_store: any, options: dict): void;

        get(key: string): any;
        set(key: string, value: any): any;

        // using inline import to avoid breaking global scope
        connectComponentState<P = {}, S = {}>(
            component: import("react").Component<P, S>,
            keys_to_watch_for_change: string[],
            addition_callback?: (...args: any[]) => any,
        ): void;

        subscribeToKeys(keys: string[], callback: () => void);

        getUnwatchedKeys(): string[];

        use(
            middleware_func: (key: any, oldval: any, newval: any) => bool,
        ): void;
    };
    export let middleware: {
        logChanges(key: string, oldval: any, newval: any): bool;
    };
}

declare var initial_data: {
    gdbgui_version: string;
    gdb_command: string;
    initial_binary_and_args: string[];
    project_home: string | null;
    remap_sources: any;
    themes: string[];
    signals: any;
    using_windows: boolean;
};
declare var debug: boolean;

type SourceCodeObjType = Record<number, string>;

type CachedFileType = {
    fullname: string;
    source_code_obj: SourceCodeObjType;
    assembly: any;
    last_modified_unix_sec: number;
    num_lines_in_file: number;
    exists: boolean;
};
