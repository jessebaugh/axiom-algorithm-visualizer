// src/App.tsx
import { useState, useRef, useEffect, useCallback } from 'react';
import SupportModal from './components/SupportModal';
import Header from './components/Header';
import Navigator from './components/Navigator';
import VisualizationViewer from './components/VisualizationViewer';
import CodeEditor from './components/CodeEditor';
import type { Timeline } from './types/timeline';

export default function App() {
    const gridRef = useRef<HTMLDivElement>(null);
    const weights = useRef([20, 40, 40]); 
    
    const [commands, setCommands] = useState<Timeline>([]);
    const [step, setStep] = useState<number>(1);

    // Initial files state managed in App so Navigator can update it
    const [editorFiles, setEditorFiles] = useState<Record<string, { id: string; name: string; language: string; content: string }>>({
        'file-1': {
            id: 'file-1',
            name: 'README.md',
            language: 'markdown',
            content: `# Knight's Tour Problem\n\nA knight's tour is a sequence of moves of a knight on a chessboard such that the knight visits every square exactly once.`
        },
        'file-2': {
            id: 'file-2',
            name: 'code.js',
            language: 'javascript',
            content: `const { Array2DTracer, LogTracer, Tracer } = require('algorithm-visualizer');\n\nconst board = new Array2DTracer('Board');\nconst pos = new Array2DTracer('Knight Position');\nconst console = new LogTracer('Console');\n\nboard.set([\n    [-1, -1, -1],\n    [-1, -1, -1],\n    [-1, -1, -1]\n]);\npos.set([[-1, -1]]);\nTracer.delay();\n\nboard.patch(0, 0, 0);\nconsole.println("Move to 0,0");\nTracer.delay();`
        }
    });
    const [activeFileId, setActiveFileId] = useState<string>('file-2');
    const [contributors, setContributors] = useState<string[]>(['archie94', 'nadr0', '64json', 'Yee172']);
    const [isSupportOpen, setIsSupportOpen] = useState(() => window.location.pathname === '/support');

    useEffect(() => {
        const handlePopState = () => setIsSupportOpen(window.location.pathname === '/support');
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const openSupport = () => {
        window.history.pushState({}, '', '/support');
        setIsSupportOpen(true);
    };

    const closeSupport = () => {
        window.history.pushState({}, '', '/');
        setIsSupportOpen(false);
    };

    const handleSelectAlgorithm = (files: Record<string, string>, newContributors: string[] = []) => {
        const newFiles: Record<string, { id: string; name: string; language: string; content: string }> = {};
        let firstId = '';
        let defaultId = '';

        Object.entries(files).forEach(([name, content], index) => {
            const id = `file-algo-${index}`;
            if (index === 0) firstId = id;
            if (name === 'code.js' || name === 'code.java') defaultId = id;
            
            let language = 'javascript';
            if (name.endsWith('.md')) language = 'markdown';
            else if (name.endsWith('.java')) language = 'java';
            else if (name.endsWith('.cpp')) language = 'cpp';

            newFiles[id] = { id, name, language, content };
        });

        setEditorFiles(newFiles);
        setActiveFileId(defaultId || firstId);
        setCommands([]);
        setStep(1);
        setContributors(newContributors);
    };

    // useCallback marks these as event handlers, so react-hooks/refs allows the
    // weights.current read inside them.
    const handleMouseDown = useCallback((index: number) => (e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWeights: number[] = weights.current;
        const gridWidth = gridRef.current?.offsetWidth || 1;
        const totalWeight = startWeights.reduce((a, b) => a + b, 0);

        const onMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaWeight = (deltaX / gridWidth) * totalWeight;
            const newWeights = [...startWeights];
            
            if (index === 0) {
                newWeights[0] = Math.max(5, startWeights[0] + deltaWeight);
                newWeights[1] = Math.max(5, startWeights[1] - deltaWeight);
            } else if (index === 1) {
                newWeights[1] = Math.max(5, startWeights[1] + deltaWeight);
                newWeights[2] = Math.max(5, startWeights[2] - deltaWeight);
            }

            weights.current = newWeights;

            if (gridRef.current) {
                gridRef.current.style.setProperty('--col1', `${newWeights[0]}fr`);
                gridRef.current.style.setProperty('--col2', `${newWeights[1]}fr`);
                gridRef.current.style.setProperty('--col3', `${newWeights[2]}fr`);
            }
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            window.dispatchEvent(new Event('resize'));
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, []);

    // Defined outside the render return: react-hooks/refs treats callbacks created
    // inline in the returned JSX as potentially running during render.
    const onResizeStart0 = handleMouseDown(0);
    const onResizeStart1 = handleMouseDown(1);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#393939', color: '#bbbbbb', fontFamily: 'Roboto, sans-serif', fontSize: '12px' }}>
            <Header onOpenSupport={openSupport} />
            <SupportModal isOpen={isSupportOpen} onClose={closeSupport} />
            <div ref={gridRef} style={{ display: 'grid', gridTemplateColumns: 'var(--col1, 20fr) 1px var(--col2, 40fr) 1px var(--col3, 40fr)', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                
                {/* Navigator with selection callback */}
                <Navigator onSelectAlgorithm={handleSelectAlgorithm} />
                
                <div style={{ position: 'relative', backgroundColor: '#505050' }}>
                    <div onMouseDown={onResizeStart0} style={{ position: 'absolute', top: 0, bottom: 0, left: '-4px', right: '-4px', cursor: 'col-resize', zIndex: 50 }} />
                </div>
                
                <VisualizationViewer 
                commands={commands} 
                step={step} 
                activeFile={editorFiles[activeFileId]}
                />
                
                <div style={{ position: 'relative', backgroundColor: '#505050' }}>
                    <div onMouseDown={onResizeStart1} style={{ position: 'absolute', top: 0, bottom: 0, left: '-4px', right: '-4px', cursor: 'col-resize', zIndex: 50 }} />
                </div>
                
                <CodeEditor 
                    files={editorFiles}
                    activeFileId={activeFileId}
                    onActiveFileChange={setActiveFileId}
                    onFilesChange={setEditorFiles}
                    commands={commands} 
                    step={step} 
                    onStepChange={setStep}
                    contributors={contributors}
                    onBuildComplete={(newCommands) => {
                        setCommands(newCommands);
                        setStep(1);
                    }} 
                />
            </div>
        </div>
    );
}