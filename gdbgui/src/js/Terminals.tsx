import React from "react";
import GdbApi from "./GdbApi";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { store } from "statorgfc";
import "xterm/css/xterm.css";
import constants from "./constants";
import Actions from "./Actions";

function customKeyEventHandler(config: {
  pty_name: string;
  pty: Terminal;
  canPaste: boolean;
  pidStoreKey: string;
}) {
  return async (e: KeyboardEvent): Promise<boolean> => {
    if (!(e.type === "keydown")) {
      return true;
    }
    if (e.shiftKey && e.ctrlKey) {
      const key = e.key.toLowerCase();
      if (key === "c") {
        const toCopy = config.pty.getSelection();
        navigator.clipboard.writeText(toCopy);
        config.pty.focus();
        return false;
      } else if (key === "v") {
        if (!config.canPaste) {
          return false;
        }
        const toPaste = await navigator.clipboard.readText();

        GdbApi.get_socket()?.send(
          JSON.stringify({
            type: "pty_interaction",
            payload: {
              pty_name: config.pty_name,
              key: toPaste,
              action: "write"
            }
          })
        );
        return false;
      }
    }
    return true;
  };
}
export class Terminals extends React.Component {
  userPtyRef: React.RefObject<any>;
  programPtyRef: React.RefObject<any>;
  gdbguiPtyRef: React.RefObject<any>;
  userPty: Terminal;
  programPty: Terminal;
  gdbguiPty: Terminal;
  ptyListener:
    | ((type: "user_pty_response" | "program_pty_response", payload: string) => void)
    | null = null;
  constructor(props: any) {
    super(props);
    this.userPtyRef = React.createRef();
    this.programPtyRef = React.createRef();
    this.gdbguiPtyRef = React.createRef();
    this.terminal = this.terminal.bind(this);

    this.userPty = new Terminal({
      cursorBlink: true,
      macOptionIsMeta: true,
      scrollback: 9999
    });
    this.programPty = new Terminal({
      cursorBlink: true,
      macOptionIsMeta: true,
      scrollback: 9999
    });
    this.gdbguiPty = new Terminal({
      cursorBlink: false,
      macOptionIsMeta: true,
      scrollback: 9999,
      disableStdin: true
      // theme: { background: "#888" }
    });
  }

  terminal(ref: React.RefObject<any>) {
    return (
      <div className="relative bg-black p-0 m-0 h-full w-full">
        <div className="absolute inset-0" ref={ref}></div>
      </div>
    );
  }
  render() {
    let terminalsClass = "w-full h-full relative grid grid-cols-3 ";
    return (
      <div className={terminalsClass}>
        {this.terminal(this.userPtyRef)}
        {/* <GdbGuiTerminal /> */}
        {this.terminal(this.gdbguiPtyRef)}
        {this.terminal(this.programPtyRef)}
      </div>
    );
  }

  componentDidMount() {
    const fitAddon = new FitAddon();
    const programFitAddon = new FitAddon();
    const gdbguiFitAddon = new FitAddon();

    this.userPty.loadAddon(fitAddon);
    this.userPty.open(this.userPtyRef.current);
    this.userPty.writeln(`running command: ${store.get("gdb_command")}`);
    this.userPty.writeln("");
    this.userPty.attachCustomKeyEventHandler(
      // @ts-expect-error
      customKeyEventHandler({
        pty_name: "user_pty",
        pty: this.userPty,
        canPaste: true,
        pidStoreKey: "gdb_pid"
      })
    );
    this.userPty.onKey((data, ev) => {
      GdbApi.get_socket()?.send(
        JSON.stringify({
          type: "pty_interaction",
          payload: {
            pty_name: "user_pty",
            key: data.key,
            action: "write"
          }
        })
      );
      if (data.domEvent.code === "Enter") {
        Actions.onConsoleCommandRun();
      }
    });

    this.programPty.loadAddon(programFitAddon);
    this.programPty.open(this.programPtyRef.current);
    this.programPty.attachCustomKeyEventHandler(
      // @ts-expect-error
      customKeyEventHandler({
        pty_name: "program_pty",
        pty: this.programPty,
        canPaste: true,
        pidStoreKey: "inferior_pid"
      })
    );
    this.programPty.write(constants.xtermColors.grey);
    this.programPty.write(
      "Program output -- Programs being debugged are connected to this terminal. " +
        "You can read output and send input to the program from here."
    );
    this.programPty.writeln(constants.xtermColors.reset);
    this.programPty.onKey((data, ev) => {
      GdbApi.get_socket()?.send(
        JSON.stringify({
          type: "pty_interaction",
          payload: {
            pty_name: "program_pty",
            key: data.key,
            action: "write"
          }
        })
      );
    });

    this.gdbguiPty.write(constants.xtermColors.grey);
    this.gdbguiPty.writeln("gdbgui output (read-only)");
    this.gdbguiPty.writeln(
      "Copy/Paste available in all terminals with ctrl+shift+c, ctrl+shift+v"
    );
    this.gdbguiPty.write(constants.xtermColors.reset);

    this.gdbguiPty.attachCustomKeyEventHandler(
      // @ts-expect-error
      customKeyEventHandler({ pty_name: "unused", pty: this.gdbguiPty, canPaste: false })
    );

    this.gdbguiPty.loadAddon(gdbguiFitAddon);
    this.gdbguiPty.open(this.gdbguiPtyRef.current);
    // gdbguiPty is written to elsewhere
    store.set("gdbguiPty", this.gdbguiPty);

    //TODO:is this setInterval needed
    setInterval(() => {
      fitAddon.fit();
      programFitAddon.fit();
      gdbguiFitAddon.fit();
      const socket = GdbApi.get_socket();
      if (socket === null) return;

      if (socket.readyState === WebSocket.CLOSED) {
        return;
      }
      socket.send(
        JSON.stringify({
          type: "pty_interaction",
          payload: {
            pty_name: "user_pty",
            rows: this.userPty.rows,
            cols: this.userPty.cols,
            action: "set_winsize"
          }
        })
      );

      socket.send(
        JSON.stringify({
          type: "pty_interaction",
          payload: {
            pty_name: "program_pty",
            rows: this.programPty.rows,
            cols: this.programPty.cols,
            action: "set_winsize"
          }
        })
      );
    }, 2000);

    const handleResize = () => {
      fitAddon.fit();
      programFitAddon.fit();
      gdbguiFitAddon.fit();
    };
    window.addEventListener("resize", handleResize);

    setTimeout(() => {
      handleResize();
    }, 0);

    this.ptyListener = (type, payload) => {
      if (type === "user_pty_response") {
        this.userPty.write(payload);
      } else if (type === "program_pty_response") {
        this.programPty.write(payload);
      }
    };
    GdbApi.add_pty_listener(this.ptyListener);
  }

  componentWillUnmount() {
    if (this.ptyListener) {
      GdbApi.remove_pty_listener(this.ptyListener);
    }
  }
}
