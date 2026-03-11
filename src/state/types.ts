export type ModelMode = 'basic' | 'advanced';
export type ModelStatus = 'loading' | 'ready' | 'error';
export type GenerationStatus = 'idle' | 'generating' | 'success' | 'error';
export type PseStatus = 'idle' | 'loading' | 'success' | 'error';

export type ModelErrorCode =
  | 'WEBGPU_UNAVAILABLE'
  | 'MODEL_LOAD_FAILED'
  | 'GENERATION_FAILED'
  | 'CANCELLED';

export interface GenerationResult {
  text: string;
  elapsedMs: number;
}

export interface ModelRuntime {
  init(onProgress?: (stage: string) => void): Promise<void>;
  generate(query: string, signal: AbortSignal): Promise<GenerationResult>;
}
