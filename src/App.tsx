import { useRef } from 'react'
import './App.css'

import { Editor, type OnMount } from '@monaco-editor/react'
import { editor } from 'monaco-editor';

function App() {
    const editorRef = useRef<editor.IStandaloneCodeEditor>(null);

    const handleEditorOnMount: OnMount = (editor, _) => {
        editorRef.current = editor;
    }

    return (
        <>
            <div className='min-h-screen h-screen flex flex-col max-h-screen min-w-screen max-w-screen overflow-hidden'>
                <div className='flex flex-row border-b-2 border-slate-100 p-3 items-center'>
                    <h1 className='text-xl! mr-auto'><span className='font-bold'>LizaLang</span> | A Dynamically Typed, Imperative Language Written in OCaml</h1>
                    <h3>Supports closures, is yet to support recursion.</h3>
                </div>
                <div className='flex flex-row flex-1'>
                    <div className='flex w-1/2 overflow-hidden'>
                        <Editor
                            height="100%"
                            width="100%"
                            defaultLanguage="liza"
                            defaultValue="// some comment"
                            onMount={handleEditorOnMount}
                        />
                    </div>
                    <div className='flex flex-col border-l-2 border-slate-100'>
                        <div className='h-[70%] border-b-2 border-slate-100'></div>
                        <div>Output:</div>
                    </div>
                </div>
            </div>
        </>
    )
}

export default App
