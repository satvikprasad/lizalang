import { useRef, useState } from "react";
import "./App.css";

import { Editor, type OnMount } from "@monaco-editor/react";
import { editor } from "monaco-editor";

import { ArrowPathIcon } from "@heroicons/react/24/solid";

type Expression =
    | {
        type: "literal";

        value:
        | {
            type: "number";
            value: number;
        }
        | {
            type: "string";
            value: string;
        }
        | {
            type: "callable";

            args: string[];
            captures: string[];

            body: Statement;
        }
        | {
            type: "true";
            value: true;
        }
        | {
            type: "false";
            value: false;
        }
        | {
            type: "list";
            value: Expression[];
        };
    }
    | {
        type: "identifier";
        value: string;
    }
    | {
        type: "unary";

        value: {
            operator: "!" | "-";
            expression: Expression;
        };
    }
    | {
        type: "binary";

        value: {
            left: Expression;
            operator: "+" | "-" | "/" | "*" | ">" | "<" | ">=" | "<=";
            right: Expression;
        };
    }
    | {
        type: "assignment";

        value: {
            identifier: string;
            expression: Expression;
        };
    }
    | {
        type: "call";
        value: {
            callable: Expression;
            args: Expression[];
        };
    }
    | {
        type: "grouping";
        value: {
            expression: Expression;
        };
    }
    | {
        type: "index";
        value: {
            expression: Expression;
            index: Expression;
        }
    };

type Statement =
    | {
        statement: "if";

        children: {
            condition: Expression;
            clause1: Statement;
            clause2: Statement | null;
        };
    }
    | {
        statement: "for";

        children: {
            initializer: Statement;
            increment: Expression;
            condition: Expression;
            body: Statement;
        };
    }
    | {
        statement: "while";

        children: {
            condition: Expression;
            body: Statement;
        };
    }
    | {
        statement: "ret";

        children: {
            expression: Expression;
        };
    }
    | {
        statement: "block";

        children: Statement[];
    }
    | {
        statement: "expression";

        children: {
            expression: Expression;
        };
    }
    | {
        statement: "print";

        children: {
            expression: Expression;
        };
    }
    | {
        statement: "declaration";
        children: {
            variable: string;
            expression: Expression;
        };
    }
    | {
        statement: "raw_block";
        children: null;
    }

type InterpretedOutput = {
    output: string;
    ast: Statement[];
};

const renderAST = (ast: Statement[]): React.JSX.Element => {
    const renderExpression = (expression: Expression): React.JSX.Element => {
        switch (expression.type) {
            case "literal":
                switch (expression.value.type) {
                    case "string":
                        return (
                            <div className="outline-1 rounded-2xl p-3 w-full text-center">
                                <p className="text-nowrap">
                                    "{expression.value.value}"
                                </p>
                            </div>
                        );
                    case "number":
                        return (
                            <div className="outline-1 rounded-2xl p-3 w-full text-center">
                                {expression.value.value}
                            </div>
                        );
                    case "callable":
                        return (
                            <div className="flex flex-col gap-3">
                                <div className="text-center outline-1 p-3 rounded-2xl font-mono">
                                    fn
                                </div>
                                <div className="flex flex-row gap-3 items-start">
                                    <p className=" text-nowrap outline-1 p-3 rounded-2xl">
                                        <span className="font-bold">args:</span>{" "}
                                        <span className="font-mono">
                                            [
                                            {expression.value.args.reduce(
                                                (acc, item) => {
                                                    if (acc == "") {
                                                        return item;
                                                    }

                                                    return acc + ", " + item;
                                                },
                                                ""
                                            )}
                                            ]
                                        </span>
                                    </p>
                                    <p className="text-nowrap outline-1 p-3 rounded-2xl">
                                        <span className="font-bold">
                                            captures:
                                        </span>{" "}
                                        <span className="font-mono">
                                            [
                                            {expression.value.captures.reduce(
                                                (acc, item) => {
                                                    if (acc == "") {
                                                        return item;
                                                    }

                                                    return acc + ", " + item;
                                                },
                                                ""
                                            )}
                                            ]
                                        </span>
                                    </p>
                                    {renderStatement(expression.value.body)}
                                </div>
                            </div>
                        );
                    case "true":
                        return (
                            <div className="outline-1 rounded-2xl p-3 text-center font-mono">
                                True
                            </div>
                        );
                    case "false":
                        return (
                            <div className="outline-1 rounded-2xl p-3 text-center font-mono">
                                False
                            </div>
                        );
                    case "list":
                        return <div className="flex flex-col gap-3">
                            <div className="text-center outline-1 p-3 rounded-2xl font-mono">
                                list
                            </div>
                            <div className="flex flex-row gap-3 items-start">
                                {
                                    expression.value.value.map(expr => renderExpression(expr))
                                }
                            </div>
                        </div>
                }
            case "identifier":
                return (
                    <div className="outline-1 rounded-2xl p-3">
                        {expression.value}
                    </div>
                );
            case "unary":
                return (
                    <div className="flex flex-col gap-3">
                        <div className="text-center outline-1 rounded-2xl p-3">
                            {expression.value.operator}
                        </div>
                        <div className="flex flex-row">
                            {renderExpression(expression.value.expression)}
                        </div>
                    </div>
                );
            case "binary":
                return (
                    <div className="flex flex-col gap-3">
                        <div className="text-center outline-1 rounded-2xl p-3">
                            {expression.value.operator}
                        </div>
                        <div className="flex flex-row gap-3 items-start">
                            {renderExpression(expression.value.left)}
                            {renderExpression(expression.value.right)}
                        </div>
                    </div>
                );
            case "assignment":
                return (
                    <div className="flex flex-col gap-3">
                        <div className="text-center outline-1 rounded-2xl p-3">
                            {"="}
                        </div>
                        <div className="flex flex-row gap-3 items-start">
                            <div className="outline-1 p-3 rounded-2xl">
                                {expression.value.identifier}
                            </div>
                            {renderExpression(expression.value.expression)}
                        </div>
                    </div>
                );
            case "call":
                return (
                    <div className="flex flex-col gap-3">
                        <div className="font-mono text-center outline-1 rounded-2xl p-3">
                            call
                        </div>
                        <div className="flex flex-row gap-3 items-start">
                            {renderExpression(expression.value.callable)}
                            {expression.value.args.map((arg) => {
                                return renderExpression(arg);
                            })}
                        </div>
                    </div>
                );
            case "grouping":
                return renderExpression(expression.value.expression);
            case "index":
                return <div className="flex flex-col gap-3">
                    <div className="font-mono text-center outline-1 rounded-2xl p-3">
                        index
                    </div>
                    <div className="flex flex-row gap-3 items-start">
                        {renderExpression(expression.value.expression)}
                        {renderExpression(expression.value.index)}
                    </div>
                </div>
        }
    };

    const renderStatement = (statement: Statement): React.JSX.Element => {
        switch (statement.statement) {
            case "if":
                return (
                    <div className="flex flex-col gap-3">
                        <div className="font-mono text-center outline-1 rounded-2xl p-3">
                            if / else
                        </div>
                        {statement.children.clause2 ? (
                            <div className="flex flex-row gap-3 items-start">
                                {renderExpression(statement.children.condition)}
                                {renderStatement(statement.children.clause1)}
                                {renderStatement(statement.children.clause2)}
                            </div>
                        ) : (
                            <div className="flex flex-row gap-3 items-start">
                                {renderExpression(statement.children.condition)}
                                {renderStatement(statement.children.clause1)}
                            </div>
                        )}
                    </div>
                );
            case "for":
                return (
                    <div className="flex flex-col gap-3">
                        <div className="text-center outline-1 rounded-2xl p-3">
                            for
                        </div>
                        <div className="flex flex-row gap-3">
                            {renderStatement(statement.children.initializer)}
                            {renderExpression(statement.children.condition)}
                            {renderExpression(statement.children.increment)}
                            {renderStatement(statement.children.body)}
                        </div>
                    </div>
                );
            case "while":
                return (
                    <div className="flex flex-col gap-3">
                        <div className="text-center outline-1 rounded-2xl p-3">
                            while
                        </div>
                        <div className="flex flex-row gap-3">
                            {renderExpression(statement.children.condition)}
                            {renderStatement(statement.children.body)}
                        </div>
                    </div>
                );
            case "ret":
                return (
                    <div className="flex flex-col gap-3">
                        <div className="text-center outline-1 rounded-2xl p-3">
                            ret
                        </div>
                        <div className="flex flex-row">
                            {renderExpression(statement.children.expression)}
                        </div>
                    </div>
                );
            case "block":
                return (
                    <div className="flex flex-col gap-3">
                        <div className="text-center outline-1 rounded-2xl p-3">
                            <p className="font-mono text-nowrap">{"{ ... }"}</p>
                        </div>
                        <div className="flex flex-row gap-3 items-start">
                            {statement.children.map((s) => renderStatement(s))}
                        </div>
                    </div>
                );
            case "expression":
                return renderExpression(statement.children.expression);
            case "print":
                return (
                    <div className="flex flex-col gap-3">
                        <div className="text-center outline-1 rounded-2xl p-3">
                            <p className="font-mono">print</p>
                        </div>
                        <div className="flex flex-row text-center">
                            {renderExpression(statement.children.expression)}
                        </div>
                    </div>
                );
            case "declaration":
                return (
                    <div className="flex flex-col gap-3 items-start">
                        <div className="text-center w-full outline-1 rounded-2xl p-3">
                            {":="}
                        </div>
                        <div className="flex flex-row gap-3 items-start">
                            <p className="outline-1 rounded-2xl p-3">
                                {statement.children.variable}
                            </p>
                            {renderExpression(statement.children.expression)}
                        </div>
                    </div>
                );
            case "raw_block":
                return <></>;
        }
    };

    return (
        <div className="flex flex-row my-12 divide-x divide-slate-400">
            {ast.map((stat) => (
                <div className="p-6">{renderStatement(stat)}</div>
            ))}
        </div>
    );
};

function App() {
    const editorRef = useRef<editor.IStandaloneCodeEditor>(null);

    const handleEditorOnMount: OnMount = (editor, _) => {
        editorRef.current = editor;
        editor.updateOptions({
            fontSize: 16,
        });
    };

    const [output, setOutput] = useState<string>("");
    const [ast, setAst] = useState<Statement[] | null>(null);

    const [loading, setLoading] = useState(false);

    return (
        <>
            <div className="min-h-screen h-screen flex flex-col max-h-screen min-w-screen max-w-screen overflow-hidden">
                <div className="flex flex-row border-b-2 border-slate-100 p-3 items-center">
                    <h1 className="text-base! mr-auto">
                        <a
                            className="font-bold text-orange-600 hover:cursor-pointer hover:underline"
                            href="https://www.github.com/satvikprasad/liza"
                            target="_blank"
                        >
                            LizaLang
                        </a>{" "}
                        - a dynamically typed scripting language written in
                        OCaml.
                    </h1>
                    <h3>
                        Created by{" "}
                        <a
                            href="https://www.satvikprasad.com"
                            className="hover:underline"
                        >
                            Satvik Prasad
                        </a>
                    </h3>
                </div>
                <div className="flex flex-row flex-1">
                    <div className="flex w-1/3 overflow-hidden">
                        <Editor
                            height="100%"
                            width="100%"
                            defaultLanguage="liza"
                            defaultValue={`var unsorted = [
    "satvik" 
    "andrew" 
    "ronnie" 
    "banana"
];

// Capture stdlib functions: len, append
var merge = fn (a b) [len append] {
    var i = 0;
    var j = 0;

    var result = [];

    while i < len (a) or j < len (b) {
        if i >= len(a) {
            result = append (result b[j]);
            j = j + 1;

        } else if j >= len(b) {
            result = append (result a[i]);
            i = i + 1;

        } else if a[i] < b[j] {
            result = append (result a[i]);
            i = i + 1;
        } else {
            result = append (result b[j]);
            j = j + 1;
        }
    }

    ret result;
};

// Capture stdlib functions: floor
var merge_sort = fn (list start end)[floor] {
    if end == start {
        ret [list[start]];
    }

    if end < start {
        ret [];
    }

    var mid = floor ((start + end) / 2);

    var left = merge_sort (list start mid);
    var right = merge_sort (list mid + 1 end);

    ret merge (left right);
};

print "Sorted";
print unsorted;
print "INTO";
print (merge_sort (unsorted 0 len(unsorted) - 1));`}
                            onMount={handleEditorOnMount}
                        />
                    </div>
                    <div className="flex flex-col border-l-2 border-slate-100 w-2/3">
                        <div className="h-[70%] border-b-2 border-slate-100">
                            <div className="flex flex-row w-full border-b-2 border-slate-100 items-center pl-3">
                                <p>Abstract Syntax Tree Viewer</p>
                                <button
                                    className={`ml-auto p-2! w-25 ${loading ? "bg-red-600 text-white cursor-not-allowed" : "hover:cursor-pointer hover:bg-slate-100"} rounded-none!`}
                                    onClick={async () => {
                                        if (loading) return;

                                        const backendUrl = import.meta.env
                                            .VITE_BACKEND_URL;

                                        const endpoint = `${backendUrl}/run`;

                                        setLoading(true);

                                        const res = await fetch(endpoint, {
                                            method: "POST",
                                            headers: {
                                                "Content-Type":
                                                    "application/json",
                                            },
                                            body: JSON.stringify({
                                                code: editorRef.current?.getValue(),
                                            }),
                                        });

                                        setLoading(false);

                                        const out: InterpretedOutput =
                                            await res.json();

                                        console.log(out);

                                        setOutput(out.output);
                                        setAst(out.ast);
                                    }}
                                >
                                    {
                                        loading ? <ArrowPathIcon className="mx-auto h-5 animate-spin" /> : <>Run Code</>
                                    }
                                </button>
                            </div>
                            <div className="text-xs overflow-scroll font-mono max-h-full">
                                {ast ? renderAST(ast) : <></>}
                            </div>
                        </div>
                        <div className="p-3 flex flex-col gap-3 h-full text-green-900 bg-white">
                            <textarea
                                placeholder="Output from stdout goes here..."
                                className="h-full font-mono"
                                disabled
                                value={output}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export default App;
