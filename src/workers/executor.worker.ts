// src/workers/executor.worker.ts

interface WorkerCommand {
    key: string | null;
    method: string;
    args: unknown[];
}

// The command queue lives on the worker's global scope so it can be reset per run
const workerScope = self as unknown as { commandQueue: WorkerCommand[] };

// 1. We create a universal Mock Tracer to intercept all method calls
class MockTracer {
    key: string;
    
    constructor(key: string) {
        this.key = key;
        // The legacy app records the instantiation of tracers
        workerScope.commandQueue.push({ key: this.key, method: 'construct', args: [] });
    }

    // We use a Proxy to dynamically catch ANY method called on a tracer 
    // (e.g., .set(), .selectRow(), .patch(), .println())
    static createProxy(key: string) {
        const tracer = new MockTracer(key);
        return new Proxy(tracer, {
            get(target, propKey: string) {
                if (propKey in target) return target[propKey as keyof MockTracer];
                
                // If it's a dynamic method call, record it to the timeline
                return (...args: unknown[]) => {
                    workerScope.commandQueue.push({ 
                        key: target.key, 
                        method: propKey, 
                        args 
                    });
                };
            }
        });
    }
}

// 2. We mock the exact API surface the user expects to import
const AlgorithmVisualizerMock = {
    Array1DTracer: function(key: string) { return MockTracer.createProxy(key); },
    Array2DTracer: function(key: string) { return MockTracer.createProxy(key); },
    ChartTracer: function(key: string) { return MockTracer.createProxy(key); },
    GraphTracer: function(key: string) { return MockTracer.createProxy(key); },
    LogTracer: function(key: string) { return MockTracer.createProxy(key); },
    Layout: { setRoot: (...args: unknown[]) => { workerScope.commandQueue.push({ key: null, method: 'setRoot', args }); } },
    VerticalLayout: function(...args: unknown[]) { return { isLayout: true, args }; },
    HorizontalLayout: function(...args: unknown[]) { return { isLayout: true, args }; },
    Tracer: { delay: () => { workerScope.commandQueue.push({ key: null, method: 'delay', args: [] }); } }
};

// 3. We intercept the 'require' statement in the user's code
const customRequire = (moduleName: string) => {
    if (moduleName === 'algorithm-visualizer') {
        return AlgorithmVisualizerMock;
    }
    throw new Error(`Module not found: ${moduleName}`);
};

// 4. The main execution listener
self.onmessage = function (e: MessageEvent) {
    const { code } = e.data;
    
    // Reset the global command queue for this run
    workerScope.commandQueue = [];

    try {
        // Evaluate the user's code in a restricted Function scope, injecting our custom 'require'
        // In a full production app, you would use a deeper sandbox (like an iframe or WebAssembly container),
        // but new Function() is sufficient for a client-side execution clone.
        const executeAlgorithm = new Function('require', code);
        executeAlgorithm(customRequire);

        // Post the recorded timeline payload back to the React UI
        self.postMessage({ 
            success: true, 
            commands: workerScope.commandQueue 
        });
    } catch (error: unknown) {
        self.postMessage({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Execution failed' 
        });
    }
};