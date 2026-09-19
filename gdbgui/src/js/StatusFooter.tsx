import React from "react";
import { store } from "statorgfc";
// import constants from "./constants";

class StatusFooter extends React.Component<{}, {}> {
    constructor(props: {}) {
        super(props);
        store.connectComponentState(this, [
            "status_message",
            "status_message_level",
        ]);
    }
    render() {
        return <></>;
    }

    // render() {
    //     return (
    //         <div
    //             className="w-full px-2 py-2"
    //             style={{
    //                 backgroundColor: `${constants.statusFooterColours[store.get("status_message_level")]}`,
    //                 color: "black",
    //             }}
    //         >
    //             {store.get("status_message")}
    //         </div>
    //     );
    // }
}

export default StatusFooter;
