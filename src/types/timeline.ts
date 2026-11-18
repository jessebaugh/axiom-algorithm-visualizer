// src/types/timeline.ts

// One recorded tracer call from the executor worker (e.g. set, select, println).
// Args are `unknown` because the payload comes from running user code, so each
// consumer must narrow them before use.
export interface TimelineCommand {
    key?: string;
    method?: string;
    args?: unknown[];
}

// The timeline is grouped into chunks delimited by Tracer.delay() calls; one
// chunk is applied per playback step.
export type Timeline = TimelineCommand[][];
