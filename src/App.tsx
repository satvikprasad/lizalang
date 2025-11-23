import { useRef, useState } from 'react'
import './App.css'

import { Editor, type OnMount } from '@monaco-editor/react'
import { editor } from 'monaco-editor';

type Expression = {
    type: "literal",

    value: {
        type: "number",
        value: number
    } | {
        type: "string",
        value: string
    } | {
        type: "callable",

        args: string[],
        captures: string[],

        body: Statement
    } | {
        type: "true",
        value: true,
    } | {
        type: "false",
        value: false
    }
} | {
    type: "identifier",
    value: string
} | {
    type: "unary",

    value: {
        operator: "!" | "-",
        expression: Expression
    }
} | {
    type: "binary",

    value: {
        left: Expression,
        operator: "+" | "-" | "/" | "*" | ">" | "<" | ">=" | "<=",
        right: Expression
    }
} | {
    type: "assignment",

    value: {
        identifier: string,
        expression: Expression
    }
} | {
    type: "call",
    value: {
        callable: Expression,
        args: Expression[]
    }
} | {
    type: "grouping",
    value: {
        expression: Expression
    }
}


type Statement = {
    statement: "if",

    children: {
        condition: Expression,
        clause1: Statement,
        clause2: Statement | null,
    }
} | {
    statement: "for",

    children: {
        initializer: Statement,
        increment: Expression,
        condition: Expression,
        body: Statement
    }
} | {
    statement: "while",

    children: {
        condition: Expression,
        body: Statement
    }
} | {
    statement: "ret",

    children: {
        expression: Expression
    }
} | {
    statement: "block",

    children: Statement[]
} | {
    statement: "expression",

    children: {
        expression: Expression
    }
} | {
    statement: "print",

    children: {
        expression: Expression
    }
} | {
    statement: "declaration",
    children: {
        variable: string,
        expression: Expression
    }
}

type InterpretedOutput = {
    output: string;
    ast: Statement[];
}

const renderAST = (ast: Statement[]): React.JSX.Element => {
    const renderExpression = (expression: Expression): React.JSX.Element => {
        console.log(expression);

        if (expression == undefined) return <></>;

        switch (expression.type) {
            case 'literal':
                switch (expression.value.type) {
                    case 'string':
                        return <div className='outline-1 rounded-2xl p-3'><p className='text-nowrap'>"{expression.value.value}"</p></div>;
                    case 'number':
                        return <div className='outline-1 rounded-2xl p-3'>{expression.value.value}</div>;
                    case 'callable':
                        return <div className='flex flex-col gap-3'>
                            <div className='text-center outline-1 p-3 rounded-2xl mx-auto font-mono'>fn</div>
                            <div className='flex flex-row gap-3 items-start'>
                                <p className=' text-nowrap outline-1 p-3 rounded-2xl'><span className='font-bold'>args:</span> <span className='font-mono'>[{expression.value.args.reduce((acc, item) => {
                                    if (acc == "") {
                                        return item;
                                    }

                                    return acc + ", " + item;
                                }, "")}]</span></p>
                                <p className='text-nowrap outline-1 p-3 rounded-2xl'><span className='font-bold'>captures:</span> <span className='font-mono'>[{expression.value.captures.reduce((acc, item) => {
                                    if (acc == "") {
                                        return item;
                                    }

                                    return acc + ", " + item;
                                }, "")}]</span></p>
                                {renderStatement(expression.value.body)}
                            </div>
                        </div>;
                    case 'true':
                        return <div className='outline-1 rounded-2xl p-3 text-center font-mono'>True</div>;
                    case 'false':
                        return <div className='outline-1 rounded-2xl p-3 text-center font-mono'>False</div>;
                }
            case 'identifier':
                return <div className='outline-1 rounded-2xl p-3'>{expression.value}</div>
            case 'unary':
                return <div className='flex flex-col gap-3'>
                    <div className='mx-auto outline-1 rounded-2xl p-3'>
                        {expression.value.operator}
                    </div>
                    <div className='flex flex-row'>
                        {renderExpression(expression.value.expression)}
                    </div>
                </div>;
            case 'binary':
                console.log(expression.value.right);

                return <div className='flex flex-col gap-3'>
                    <div className='mx-auto outline-1 rounded-2xl p-3'>
                        {expression.value.operator}
                    </div>
                    <div className='flex flex-row gap-3 items-start'>
                        {renderExpression(expression.value.left)}
                        {renderExpression(expression.value.right)}
                    </div>
                </div>;
            case 'assignment':
                return <div className='flex flex-col gap-3'>
                    <div className='mx-auto outline-1 rounded-2xl p-3'>
                        {"="}
                    </div>
                    <div className='flex flex-row gap-3 items-start'>
                        <div className='outline-1 p-3 rounded-2xl'>{expression.value.identifier}</div>
                        {renderExpression(expression.value.expression)}
                    </div>
                </div>;
            case 'call':
                return <div className='flex flex-col gap-3'>
                    <div className='font-mono mx-auto outline-1 rounded-2xl p-3'>
                        call
                    </div>
                    <div className='flex flex-row gap-3 items-start'>
                        {renderExpression(expression.value.callable)}
                        {expression.value.args.map((arg) => {
                            return renderExpression(arg);
                        })}
                    </div>
                </div>;
            case "grouping":
                return renderExpression(expression.value.expression);
        }
    }

    const renderStatement = (statement: Statement): React.JSX.Element => {
        console.log(statement);

        switch (statement.statement) {
            case 'if':
                return <div className='flex flex-col gap-3'>
                    <div className='font-mono mx-auto outline-1 rounded-2xl p-3'>
                        if / else
                    </div>
                    {statement.children.clause2 ?
                        <div className='flex flex-row gap-3 items-start'>
                            {renderExpression(statement.children.condition)}
                            {renderStatement(statement.children.clause1)}
                            {renderStatement(statement.children.clause2)}
                        </div> :
                        <div className='flex flex-row gap-3 items-start'>
                            {renderExpression(statement.children.condition)}
                            {renderStatement(statement.children.clause1)}
                        </div>}
                </div>;
            case 'for':
                return <div className='flex flex-col gap-3'>
                    <div className='mx-auto outline-1 rounded-2xl p-3'>
                        For
                    </div>
                    <div className='flex flex-row gap-3'>
                        {renderStatement(statement.children.initializer)}
                        {renderExpression(statement.children.condition)}
                        {renderExpression(statement.children.increment)}
                        {renderStatement(statement.children.body)}
                    </div>
                </div>;
            case 'while':
                return <div className='flex flex-col gap-3'>
                    <div className='mx-auto outline-1 rounded-2xl p-3'>
                        While
                    </div>
                    <div className='flex flex-row gap-3'>
                        {renderExpression(statement.children.condition)}
                        {renderStatement(statement.children.body)}
                    </div>
                </div>;
            case 'ret':
                return <div className='flex flex-col gap-3'>
                    <div className='mx-auto outline-1 rounded-2xl p-3'>
                        ret
                    </div>
                    <div className='flex flex-row'>
                        {renderExpression(statement.children.expression)}
                    </div>
                </div>;
            case 'block':
                return <div className='flex flex-col gap-3'>
                    <div className='mx-auto outline-1 rounded-2xl p-3'>
                        <p className='font-mono text-nowrap'>{"{ ... }"}</p>
                    </div>
                    <div className='flex flex-row'>
                        {statement.children.map((s) => renderStatement(s))}
                    </div>
                </div>;
            case 'expression':
                return renderExpression(statement.children.expression);
            case 'print':
                return <div className='flex flex-col gap-3'>
                    <div className='mx-auto outline-1 rounded-2xl p-3'>
                        <p className='font-mono'>print</p>
                    </div>
                    <div className='flex flex-row mx-auto'>
                        {renderExpression(statement.children.expression)}
                    </div>
                </div>;
            case 'declaration':
                return <div className='flex flex-col gap-3 items-start'>
                    <div className='mx-auto outline-1 rounded-2xl p-3'>
                        {":="}
                    </div>
                    <div className='flex flex-row gap-3 items-start'>
                        <p className='outline-1 rounded-2xl p-3'>{statement.children.variable}</p>
                        {renderExpression(statement.children.expression)}
                    </div>
                </div>;
        }
    }

    return <div className='flex flex-row gap-12 my-12'>
        {ast.map(stat => <div className='p-3'>{renderStatement(stat)}</div>)}
    </div>
}

function App() {
    const editorRef = useRef<editor.IStandaloneCodeEditor>(null);

    const handleEditorOnMount: OnMount = (editor, _) => {
        editorRef.current = editor;
        editor.updateOptions({
            fontSize: 16
        });
    }

    const [output, setOutput] = useState<string>("");
    const [ast, setAst] = useState<Statement[] | null>(null);

    return (
        <>
            <div className='min-h-screen h-screen flex flex-col max-h-screen min-w-screen max-w-screen overflow-hidden'>
                <div className='flex flex-row border-b-2 border-slate-100 p-3 items-center'>
                    <h1 className='text-xl! mr-auto'><a className='font-bold text-orange-600 hover:cursor-pointer hover:underline' href="https://www.github.com/satvikprasad/liza" target='_blank'>LizaLang</a> - a dynamically typed scripting language written in OCaml.</h1>
                    <h3>Created by <a href="https://www.satvikprasad.com" className='hover:underline'>Satvik Prasad</a></h3>
                </div>
                <div className='flex flex-row flex-1'>
                    <div className='flex w-1/3 overflow-hidden'>
                        <Editor
                            height="100%"
                            width="100%"
                            defaultLanguage="liza"
                            defaultValue={`// Rebind print
var c = 0;
var d = 0;

// Capture c and d in closure
var p = fn (s i)[c d] {
    print i + 1 + ". " + s + " | " + (c = c + 1) + ", " + (d = d*d + 2/(c*c));
};

if true {
    // Print 10 'Hello World!'
    for var i = 0; i < 10; i = i + 2 {
        p("Hello World!" i);
    }
} else if false {
    print 5;
}`}
                            onMount={handleEditorOnMount}
                        />
                    </div>
                    <div className='flex flex-col border-l-2 border-slate-100 w-2/3'>
                        <div className='h-[70%] border-b-2 border-slate-100'>
                            <div className='flex flex-row w-full border-b-2 border-slate-100 items-center pl-3'>
                            <p>Abstract Syntax Tree Viewer</p>
                                <button className='ml-auto p-2! rounded-none!' onClick={async () => {
                                    const backendUrl = import.meta.env.VITE_BACKEND_URL;

                                    const endpoint = `${backendUrl}/run`;

                                    const res = await fetch(endpoint, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify({
                                            code: editorRef.current?.getValue()
                                        })
                                    })

                                    const out: InterpretedOutput = await res.json();

                                    console.log(out);

                                    setOutput(out.output);
                                    setAst(out.ast);
                                }}>
                                    Run Code
                                </button>
                            </div>
                            <div className='overflow-scroll font-mono max-h-full'>
                                {
                                    ast ? renderAST(ast) : <></>
                                }
                            </div>
                        </div>
                        <div className='p-6 flex flex-col gap-3 h-full text-green-900 bg-white'>
                            <textarea placeholder='Output from stdout goes here...' className='h-full font-mono' disabled value={output} />
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

export default App
