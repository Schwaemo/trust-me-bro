import { enforceOverviewConstraints } from '../overview/postprocess';
import { getTestMode } from '../../lib/testMode';
import type { GenerationResult, ModelMode, ModelRuntime } from '../../state/types';
import { BrowserModelRuntime, ModelRuntimeError } from './gemmaRuntime';
import { getModelCatalogEntry } from './modelCatalog';

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

class MockRuntime implements ModelRuntime {
  private readonly mode: 'mock-ready' | 'mock-init-error' | 'mock-generation-error';

  constructor(mode: 'mock-ready' | 'mock-init-error' | 'mock-generation-error') {
    this.mode = mode;
  }

  async init(onProgress?: (stage: string) => void): Promise<void> {
    onProgress?.('Checking WebGPU...');
    await sleep(75);

    if (this.mode === 'mock-init-error') {
      throw new ModelRuntimeError('Mock init error.', 'MODEL_LOAD_FAILED');
    }

    onProgress?.('Downloading model...');
    await sleep(75);

    onProgress?.('Warming up model...');
    await sleep(75);

    onProgress?.('Model ready.');
  }

  async generate(query: string, signal: AbortSignal): Promise<GenerationResult> {
    if (signal.aborted) {
      throw new ModelRuntimeError('Mock cancellation.', 'CANCELLED');
    }

    await sleep(50);

    if (this.mode === 'mock-generation-error') {
      throw new ModelRuntimeError('Mock generation error.', 'GENERATION_FAILED');
    }

    const text = enforceOverviewConstraints(
      `This is a local mock response for ${query}. It is concise and matter-of-fact.`,
    );

    return {
      text,
      elapsedMs: 50,
    };
  }
}

export const createModelRuntime = (modelMode: ModelMode): ModelRuntime => {
  const mode = getTestMode();

  if (mode === 'mock-ready') {
    return new MockRuntime('mock-ready');
  }

  if (mode === 'mock-init-error') {
    return new MockRuntime('mock-init-error');
  }

  if (mode === 'mock-generation-error') {
    return new MockRuntime('mock-generation-error');
  }

  return new BrowserModelRuntime(getModelCatalogEntry(modelMode));
};
