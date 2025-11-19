import { useRef, useState } from 'react'
import './App.css'

import { Editor, type OnMount } from '@monaco-editor/react'
import { editor } from 'monaco-editor';

function App() {
    const editorRef = useRef<editor.IStandaloneCodeEditor>(null);

    const handleEditorOnMount: OnMount = (editor, _) => {
        editorRef.current = editor;
        editor.updateOptions({
            fontSize: 16
        });
    }

    const [output, setOutput] = useState<string>("");

    return (
        <>
            <div className='min-h-screen h-screen flex flex-col max-h-screen min-w-screen max-w-screen overflow-hidden'>
                <div className='flex flex-row border-b-2 border-slate-100 p-3 items-center'>
                    <h1 className='text-xl! mr-auto'><a className='font-bold text-orange-600 hover:cursor-pointer hover:underline' href="https://www.github.com/satvikprasad/liza" target='_blank'>LizaLang</a> | A Dynamically Typed, Imperative Language Written in OCaml</h1>
                    <h3>Created by <a href="https://www.satvikprasad.com" className='hover:underline'>Satvik Prasad</a></h3>
                </div>
                <div className='flex flex-row flex-1'>
                    <div className='flex w-1/2 overflow-hidden'>
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
                    <div className='flex flex-col border-l-2 border-slate-100 w-1/2'>
                        <div className='h-[70%] border-b-2 border-slate-100'>
                            <div className='flex flex-row w-full border-b-2 border-slate-100'>
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

                                    const out = await res.text();

                                    setOutput(out);
                                }}>
                                    Run Code
                                </button>
                            </div>
                        </div>
                        <div className='p-6 flex flex-col gap-3 h-full text-green-900'>
                            <textarea placeholder='Output from stdout goes here...' className='h-full font-mono' disabled value={output} />
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

export default App
