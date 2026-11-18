// src/tracers/BaseTracer.ts

export interface TraceCommand {
    action: 'alloc' | 'set' | 'swap' | 'select' | 'deselect';
    target: string;
    args: unknown[];
}

export abstract class BaseTracer {
    protected key: string;
    protected commandQueue: TraceCommand[] = [];

    constructor(key: string) {
        this.key = key;
    }

    protected pushCommand(action: TraceCommand['action'], args: unknown[] = []) {
        this.commandQueue.push({
            action,
            target: this.key,
            args
        });
    }

    public getTraces(): TraceCommand[] {
        return this.commandQueue;
    }

    public clearTraces(): void {
        this.commandQueue = [];
    }
}