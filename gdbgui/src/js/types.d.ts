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
