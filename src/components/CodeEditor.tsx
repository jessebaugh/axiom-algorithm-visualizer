// src/components/CodeEditor.tsx
import { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import ExecutorWorker from '../workers/executor.worker?worker';
import type { Timeline, TimelineCommand } from '../types/timeline';

type FileState = { id: string; name: string; language: string; content: string };

interface CodeEditorProps {
    files: Record<string, FileState>;
    contributors?: string[];
    activeFileId: string;
    onActiveFileChange: (id: string) => void;
    onFilesChange: React.Dispatch<React.SetStateAction<Record<string, FileState>>>;
    commands: Timeline;
    step: number;
    onStepChange: (step: number) => void;
    onBuildComplete: (commands: Timeline) => void;
}

export default function CodeEditor({ 
    files,
    contributors = [], 
    activeFileId, 
    onActiveFileChange, 
    onFilesChange,
    commands, 
    step, 
    onStepChange, 
    onBuildComplete 
}: CodeEditorProps) {
    const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
    
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(2); 
    
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        let interval: ReturnType<typeof setTimeout>;
        // Stop automatically once the last step is reached; deriving this instead of
        // calling setIsPlaying here avoids a cascading render on every effect run.
        if (isPlaying && step < commands.length) {
            const delayMs = 1000 / speed; 
            interval = setTimeout(() => {
                onStepChange(Math.min(step + 1, commands.length));
            }, delayMs);
        }
        return () => clearTimeout(interval);
    }, [isPlaying, step, commands.length, speed, onStepChange]);

    useEffect(() => {
        return () => {
            if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
        };
    }, []);

    const handleEditorDidMount = (editor: MonacoEditor.IStandaloneCodeEditor) => {
        editorRef.current = editor;
    };

    const handleAddFile = () => {
        let count = 0;
        let newFileName = 'code.js'; 
        const existingNames = Object.values(files).map(f => f.name);
        while (existingNames.includes(newFileName)) {
            count++;
            newFileName = `code-${count}.js`;
        }
        const newId = `file-${Date.now()}`;
        onFilesChange(prev => ({
            ...prev,
            [newId]: {
                id: newId, name: newFileName, language: 'javascript', 
                content: `const { Array2DTracer, LogTracer, Tracer } = require('algorithm-visualizer');\n\nconst board = new Array2DTracer('Board');\n`
            }
        }));
        onActiveFileChange(newId);
    };

    const handleDeleteClick = () => {
        if (isConfirmingDelete) {
            const newFiles = { ...files };
            delete newFiles[activeFileId];
            onFilesChange(newFiles);
            const remainingIds = Object.keys(newFiles);
            onActiveFileChange(remainingIds.includes('file-1') ? 'file-1' : remainingIds[0]);
            setIsConfirmingDelete(false);
            if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
        } else {
            setIsConfirmingDelete(true);
            deleteTimeoutRef.current = setTimeout(() => setIsConfirmingDelete(false), 2000);
        }
    };

    const activeFile = files[activeFileId] || Object.values(files)[0];

    const handleBuild = () => {
        if (activeFile.language !== 'javascript') {
            console.warn("The local browser engine currently only supports JavaScript. A backend is required for Java.");
            return;
        }

        setIsPlaying(false);
        const worker = new ExecutorWorker();
        
        worker.onmessage = (e) => {
            if (e.data.success) {
                const rawCommands = e.data.commands as TimelineCommand[];
                const chunks: Timeline = [];
                let currentChunk: TimelineCommand[] = [];
                
                rawCommands.forEach((cmd) => {
                    if (cmd.method === 'delay') {
                        chunks.push(currentChunk);
                        currentChunk = [];
                    } else {
                        currentChunk.push(cmd);
                    }
                });
                if (currentChunk.length > 0) chunks.push(currentChunk);

                onBuildComplete(chunks);
            }
            worker.terminate(); 
        };

        worker.postMessage({ code: activeFile.content });
    };

    const clipStyle: React.CSSProperties = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'clip', minWidth: 0 };

    if (!activeFile) return <aside style={{ flex: 1, backgroundColor: '#242424' }} />;

    return (
        <aside style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#242424', minWidth: 0, minHeight: 0, height: '100%' }}>
            <div style={{ height: '32px', backgroundColor: '#393939', borderBottom: '1px solid #505050', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 16px', flexShrink: 0, gap: '12px', fontSize: '12px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                <span onClick={handleBuild} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>🔧 Build</span>
                
                <span 
                    onClick={() => {
                        if (step >= commands.length) onStepChange(1); 
                        setIsPlaying(!isPlaying);
                    }} 
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: isPlaying ? '#4c1' : '#bbbbbb' }}
                >
                    {isPlaying ? '⏸ Pause' : '▶ Play'}
                </span>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#252526', padding: '2px 8px', borderRadius: '2px' }}>
                    <span onClick={() => { setIsPlaying(false); onStepChange(Math.max(1, step - 1)); }} style={{ cursor: 'pointer', color: step > 1 ? '#fff' : '#666' }}>&lt;</span>
                    <span style={{ userSelect: 'none', minWidth: '40px', textAlign: 'center' }}>
                        {commands.length > 0 ? `${step} / ${commands.length}` : '0 / 0'}
                    </span>
                    <span onClick={() => { setIsPlaying(false); onStepChange(Math.min(commands.length, step + 1)); }} style={{ cursor: 'pointer', color: step < commands.length ? '#fff' : '#666' }}>&gt;</span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>Speed</span>
                    <input 
                        type="range" min="0.5" max="5" step="0.5" 
                        value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))}
                        style={{ width: '60px', cursor: 'pointer' }} 
                    />
                </div>
            </div>

            <div style={{ display: 'flex', height: '32px', backgroundColor: '#393939', borderBottom: '1px solid #505050', flexShrink: 0, overflowX: 'auto' }}>
                {Object.values(files).map((f) => {
                    const isActive = activeFileId === f.id;
                    return (
                        <div 
                            key={f.id}
                            onClick={() => { onActiveFileChange(f.id); setIsConfirmingDelete(false); }}
                            style={{ padding: '0 15px', display: 'flex', alignItems: 'center', backgroundColor: isActive ? '#242424' : '#393939', borderTop: isActive ? '2px solid #29d' : '2px solid transparent', color: isActive ? '#fff' : '#bbbbbb', cursor: 'pointer', borderRight: '1px solid #505050', ...clipStyle }}
                        >
                            {isActive ? (
                                <input 
                                    value={f.name}
                                    onChange={(e) => onFilesChange(prev => ({ ...prev, [f.id]: { ...f, name: e.target.value } }))}
                                    onClick={(e) => e.stopPropagation()} 
                                    style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', padding: 0, margin: 0, width: `${Math.max(f.name.length, 1) + 1}ch` }}
                                />
                            ) : (f.name)}
                        </div>
                    );
                })}
                <div onClick={handleAddFile} style={{ padding: '0 15px', display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}>+</div>
            </div>

            <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
                <Editor
                    height="100%" path={activeFile.name} language={activeFile.language} theme="vs-dark" value={activeFile.content}
                    onMount={handleEditorDidMount}
                    onChange={(value) => onFilesChange(prev => ({ ...prev, [activeFileId]: { ...prev[activeFileId], content: value || '' } }))}
                    options={{ minimap: { enabled: false }, fontSize: 13, fontFamily: '"Monaco", "Menlo", monospace', padding: { top: 16 }, scrollBeyondLastLine: false, wordWrap: 'off' }}
                />
            </div>
            
            <div style={{ height: '36px', backgroundColor: '#393939', borderTop: '1px solid #505050', display: 'flex', alignItems: 'center', padding: '0 16px', fontSize: '12px', flexShrink: 0, ...clipStyle }}>
                <span style={{ fontWeight: 'bold', flexShrink: 0 }}>Contributed by</span>
                <div style={{ marginLeft: '10px', display: 'flex', alignItems: 'center', gap: '10px', overflowX: 'auto', ...clipStyle }}>
                    {['algorithm-visualizer', ...contributors].map((user) => (
                        <a
                            key={user}
                            href={`https://github.com/${user}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#bbbbbb', textDecoration: 'none', flexShrink: 0 }}
                        >
                            <img
                                src={`https://github.com/${user}.png?size=32`}
                                alt={user}
                                style={{ width: '16px', height: '16px', borderRadius: '2px' }}
                            />
                            <span>{user}</span>
                        </a>
                    ))}
                </div>
                {activeFile.name !== 'README.md' && (
                    <span onClick={handleDeleteClick} style={{ marginLeft: 'auto', paddingLeft: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, color: isConfirmingDelete ? '#f3bd58' : '#bbbbbb', fontWeight: isConfirmingDelete ? 'bold' : 'normal' }}>
                        {isConfirmingDelete ? '⚠️ Click to Confirm' : '🗑 Delete File'}
                    </span>
                )}
            </div>
        </aside>
    );
}