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
    initial_binary_and_args: string[];
    cwd: string;
    remap_sources: any;
    themes: string[];
    signals: Record<string, number>;
    using_windows: boolean;
};

declare var debug: boolean;

type Target = {
    binary_and_args: string[];
    binary_and_args_comb: string;
    project_cwd: string;
    gdb_cmd: string;
};

type SourceCodeObjType = Record<number, string>;

type CachedFileType = {
    fullname: string;
    source_code_obj: SourceCodeObjType;
    assembly: any;
    last_modified_unix_sec: number;
    num_lines_in_file: number;
    exists: boolean;
};

type GdbRegisterValue = {
    number: string;
    value: string;
};

type GdbFrameArg = {
    name: string;
    value: string;
};

// frame from -stack-list-frames, or thread["frame"] from -thread-info
type GdbFrame = {
    addr: string;
    func: string;
    fullname: string;
    file: string;
    line: string;
    args?: GdbFrameArg[] | undefined;
};

// thread from -thread-info
type GdbThread = {
    id: string;
    state: string;
    "target-id": string;
    name?: string;
    core?: number;
    frame?: GdbFrame;
};

type GdbLocal = any;
// {
// in_scope: "true" "invalid" //string
// expr_type: string
// name string
//expression any
// }

type GdbExpression = GdbLocal;
