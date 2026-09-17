/**
 * Setup global DOM events
 */

import GdbApi from "./GdbApi";
import { store } from "statorgfc";

const GlobalEvents = {
    init: function () {
        document.body.addEventListener("keydown", GlobalEvents.body_keydown);

        //FIXME: uncomment
        // window.onbeforeunload = () =>
        //     "text here makes dialog appear when exiting. Set function to back to null for nomal behavior.";
    },
    /**
     * keyboard shortcuts to interact with gdb.
     * enabled only when key is depressed on a target that is NOT an input.
     */
    body_keydown: function (e: KeyboardEvent) {
        if (e.target === null) return;
        if (e.key === "Enter") {
            // when pressing enter in an input, don't redirect entire page!
            e.preventDefault();
        }
        const modifier = e.altKey || e.ctrlKey || e.metaKey;

        // @ts-expect-error ts-migrate(2339) FIXME: Property nodeName does not exist on ...
        if (e.target.nodeName !== "INPUT" && !modifier) {
            switch (e.key) {
                case "ArrowDown":
                case "s":
                    GdbApi.click_step_button();
                    break;

                case "ArrowRight":
                case "n":
                    GdbApi.click_next_button(false);
                    break;

                case "N":
                    if (store.get("reverse_supported"))
                        GdbApi.click_next_button(true);
                    break;

                case "c":
                    GdbApi.click_continue_button(false);
                    break;

                case "C":
                    if (store.get("reverse_supported"))
                        GdbApi.click_continue_button(true);
                    break;

                case "ArrowUp":
                case "u":
                    GdbApi.click_return_button();
                    break;

                case "r":
                    GdbApi.click_run_button();
                    break;

                case "m":
                    GdbApi.click_next_instruction_button(false);
                    break;

                case "M":
                    if (store.get("reverse_supported"))
                        GdbApi.click_next_instruction_button(true);
                    break;

                case ",":
                    GdbApi.click_step_instruction_button(false);
                    break;

                case "<":
                    if (store.get("reverse_supported"))
                        GdbApi.click_step_instruction_button(true);
                    break;

                case "ArrowLeft":
                    if (store.get("reverse_supported"))
                        GdbApi.click_next_button(true);

                    break;
            }
        }
    },
};

export default GlobalEvents;
