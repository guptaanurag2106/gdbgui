import React from "react";
import { store } from "statorgfc";

import GdbVariable from "./GdbVariable";

class Expressions extends React.Component {
    objs_to_delete: GdbExpression[] = [];
    objs_to_render: GdbExpression[] = [];
    constructor(props: {}) {
        super(props);
        store.connectComponentState(this, ["expressions"]);
    }

    static keydown_on_input(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter") {
            let expr = e.currentTarget.value,
                trimmed_expr = expr.trim();

            if (trimmed_expr !== "") {
                GdbVariable.create_variable(trimmed_expr, "expr");
            }

            e.currentTarget.value = "";
        }
    }

    render() {
        let sorted_expression_objs = store.get("expressions");
        sorted_expression_objs.sort((e1: GdbExpression, e2: GdbExpression) =>
            e1.expression.localeCompare(e2.expression),
        );
        // only render variables in scope that were not created for the Locals component
        this.objs_to_render = sorted_expression_objs.filter(
            // TODO: does it just remove not in scope variable? may be just show not in scope
            (obj: GdbExpression) =>
                obj.in_scope === "true" && obj.expr_type === "expr",
        );
        this.objs_to_delete = sorted_expression_objs.filter(
            (obj: GdbExpression) => obj.in_scope === "invalid",
        );

        // delete invalid objects
        this.objs_to_delete.map((obj: GdbExpression) =>
            GdbVariable.delete_gdb_variable(obj.name),
        );

        let content = this.objs_to_render.map((obj: GdbExpression) => (
            <GdbVariable
                obj={obj}
                key={obj.expression}
                expression={obj.expression}
                expr_type="expr"
            />
        ));

        if (content.length === 0) {
            content.push(
                <span key="empty" className="placeholder">
                    no expressions in this context
                </span>,
            );
        }

        return (
            <div>
                <input
                    id="expressions_input"
                    placeholder="expression or variable"
                    className="mb-2 box-border w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[var(--fg)] outline-none focus:border-[var(--accent)]"
                    onKeyUp={Expressions.keydown_on_input}
                />

                {content}
            </div>
        );
    }
}

export default Expressions;
