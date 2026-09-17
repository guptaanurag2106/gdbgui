import React from "react";
import { store } from "statorgfc";

type State = any;

type ToolTipTourguideProps = {
    top?: string;
    left?: string;
    step_num: number;
    position?: string;
    content: any;
    onClick?: (e: any) => void;
};

class ToolTipTourguide extends React.Component<ToolTipTourguideProps, State> {
    ref: React.RefObject<HTMLDivElement>;
    constructor(props: ToolTipTourguideProps) {
        super(props);
        if (!props.position && !(props.top && props.left)) {
            console.warn("did not receive position");
        }
        this.ref = React.createRef<HTMLDivElement>();
        store.connectComponentState(this, [
            "tour_guide_step",
            "num_tour_guide_steps",
            "show_tour_guide",
        ]);
    }
    componentWillMount() {
        store.set(
            "num_tour_guide_steps",
            store.get("num_tour_guide_steps") + 1,
        );
    }
    static dismiss() {
        store.set("tour_guide_step", 0);
        store.set("show_tour_guide", false);
    }
    static next() {
        store.set("tour_guide_step", store.get("tour_guide_step") + 1);
    }
    static start_guide() {
        store.set("tour_guide_step", 0);
        store.set("show_tour_guide", true);
    }
    componentDidUpdate() {
        if (this.state.show_tour_guide && this.ref.current) {
            // need to ensure absolute position is respected  by setting parent to
            // relative
            // @ts-expect-error ts-migrate(2551) FIXME: Property 'ref' does not exist on type 'ToolTipTour... Remove this comment to see the full error message
            this.ref.current.parentNode.style.position = "relative";
        }
    }
    get_position(position_name: any) {
        let top, left;
        switch (position_name) {
            case "left":
                top = "100%";
                left = "-50%";
                break;
            case "right":
                top = "50%";
                left = "0px";
                break;
            case "bottom":
            case "bottomcenter":
                top = "100%";
                left = "50%";
                break;
            case "bottomleft":
                top = "100%";
                left = "0";
                break;
            case "topleft":
                top = "0";
                left = "0";
                break;
            case "overlay":
                top = "50%";
                left = "50%";
                break;
            default:
                console.warn("invalid position " + this.props.position);
                top = "100%";
                left = "50%";
                break;
        }
        return [top, left];
    }
    render() {
        if (!this.state.show_tour_guide) {
            return null;
        } else if (this.props.step_num !== this.state.tour_guide_step) {
            return null;
        }

        let top, left;
        if (this.props.top && this.props.left) {
            top = this.props.top;
            left = this.props.left;
        } else {
            [top, left] = this.get_position(this.props.position);
        }

        let is_last_step =
                this.props.step_num + 1 === this.state.num_tour_guide_steps,
            dismiss = is_last_step ? null : (
                <button
                    type="button"
                    className="pointer rounded border border-[var(--border)] bg-[var(--hover)] px-2 py-1 text-[var(--fg)] hover:bg-[var(--accent)] hover:text-[var(--bg)]"
                    onClick={ToolTipTourguide.dismiss}
                >
                    Dismiss
                </button>
            );
        return (
            <div
                ref={this.ref}
                className="absolute z-[1000] min-w-[200px] max-w-[350px] overflow-auto whitespace-normal rounded border p-2 text-m shadow-lg"
                style={{
                    left: left,
                    top: top,
                    backgroundColor: "var(--surface)",
                    borderColor: "var(--border)",
                    color: "var(--fg)",
                }}
            >
                {this.props.content}
                <div className="h-2" />
                {this.props.step_num + 1} of {this.state.num_tour_guide_steps}
                <div className="h-2" />
                {dismiss}
                <button
                    type="button"
                    className="pointer ml-2 rounded bg-[var(--accent)] px-2 py-1 hover:opacity-90"
                    style={{ color: "var(--bg)" }}
                    onClick={ToolTipTourguide.next}
                >
                    {is_last_step ? "Finish" : "Next"}
                </button>
            </div>
        );
    }
}

export default ToolTipTourguide;
