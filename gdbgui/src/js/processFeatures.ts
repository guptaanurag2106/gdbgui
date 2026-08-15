// https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Support-Commands.html#GDB_002fMI-Support-Commands

import { store } from "statorgfc";
type Feature =
  | "thread-info"
  | "reverse"
  | "async"
  | "frozen-varobjs"
  | "pending-breakpoints"
  | "data-read-memory-bytes"
  | "python"
  | "ada-task-info"
  | "language-option"
  | "info-gdb-mi-command"
  | "undefined-command-error-code"
  | "exec-run-start-option"
  | "data-disassemble-a-option"
  | "breakpoint-notification";

export function processFeatures(features: Array<Feature>) {
  // TODO:what if -list-features returns []
  // only 2 in target_features (refer above link), target_features can be []
  if (
    features.length === 0 ||
    features.includes("async") ||
    features.includes("reverse")
  ) {
    store.set("reverse_supported", features.includes("reverse"));
    const current = store.get("features");
    store.set("features", { ...current, target_features: features });
  } else {
    const current = store.get("features");
    store.set("features", { ...current, features: features });
  }
}
