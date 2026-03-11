import { pipeline } from '@huggingface/transformers';
import type { GenerationResult, ModelErrorCode, ModelRuntime } from '../../state/types';
import type { ModelCatalogEntry } from './modelCatalog';
import { buildPrompt } from '../overview/prompt';
import { enforceOverviewConstraints } from '../overview/postprocess';

const WARMUP_PROMPT = 'Hello.';

interface ProgressUpdate {
  file?: string;
  progress?: number;
  status?: string;
}

type NavigatorWithWebGpu = Navigator & {
  gpu?: {
    requestAdapter: () => Promise<unknown>;
  };
};

type GenerationOptions = {
  do_sample: boolean;
  max_new_tokens: number;
  no_repeat_ngram_size?: number;
  repetition_penalty?: number;
  return_full_text: boolean;
  temperature: number;
  top_k?: number;
  top_p: number;
};

type GeneratorFn = (prompt: string, options: GenerationOptions) => Promise<unknown>;

const asModelErrorCode = (error: unknown): ModelErrorCode => {
  if (error instanceof ModelRuntimeError) {
    return error.code;
  }
  return 'MODEL_LOAD_FAILED';
};

const asText = (output: unknown): string => {
  if (typeof output === 'string') {
    return output;
  }

  if (Array.isArray(output) && output.length > 0) {
    const first = output[0];
    if (
      typeof first === 'object' &&
      first !== null &&
      'generated_text' in first &&
      typeof first.generated_text === 'string'
    ) {
      return first.generated_text;
    }
  }

  return '';
};

const abortError = (): ModelRuntimeError => {
  return new ModelRuntimeError('Generation was cancelled.', 'CANCELLED');
};

const withAbort = async <T>(task: Promise<T>, signal: AbortSignal): Promise<T> => {
  if (signal.aborted) {
    throw abortError();
  }

  const abortPromise = new Promise<never>((_, reject) => {
    signal.addEventListener(
      'abort',
      () => {
        reject(abortError());
      },
      { once: true },
    );
  });

  return Promise.race([task, abortPromise]);
};

export class ModelRuntimeError extends Error {
  code: ModelErrorCode;

  constructor(message: string, code: ModelErrorCode) {
    super(message);
    this.name = 'ModelRuntimeError';
    this.code = code;
  }
}

export class BrowserModelRuntime implements ModelRuntime {
  private generator: GeneratorFn | null = null;
  private initPromise: Promise<void> | null = null;
  private readonly model: ModelCatalogEntry;

  constructor(model: ModelCatalogEntry) {
    this.model = model;
  }

  async init(onProgress?: (stage: string) => void): Promise<void> {
    if (this.generator) {
      onProgress?.('Model ready.');
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.initializeGenerator(onProgress);

    try {
      await this.initPromise;
    } catch (error) {
      const code = asModelErrorCode(error);
      if (code === 'WEBGPU_UNAVAILABLE') {
        throw error;
      }
      throw new ModelRuntimeError(`Failed to load ${this.model.displayName}.`, 'MODEL_LOAD_FAILED');
    } finally {
      this.initPromise = null;
    }
  }

  async generate(query: string, signal: AbortSignal): Promise<GenerationResult> {
    if (!this.generator) {
      throw new ModelRuntimeError('Model is not initialized.', 'MODEL_LOAD_FAILED');
    }

    const startedAt = performance.now();
    const prompt = buildPrompt(query);

    let output: unknown;
    try {
      output = await withAbort(
        this.generator(prompt, {
          max_new_tokens: 64,
          temperature: 0.15,
          top_p: 0.85,
          top_k: 40,
          repetition_penalty: 1.15,
          no_repeat_ngram_size: 3,
          do_sample: true,
          return_full_text: false,
        }),
        signal,
      );
    } catch (error) {
      if (error instanceof ModelRuntimeError && error.code === 'CANCELLED') {
        throw error;
      }
      throw new ModelRuntimeError('Failed during generation.', 'GENERATION_FAILED');
    }

    const text = enforceOverviewConstraints(asText(output));
    if (!text) {
      throw new ModelRuntimeError('Generated text was empty.', 'GENERATION_FAILED');
    }

    return {
      text,
      elapsedMs: Math.round(performance.now() - startedAt),
    };
  }

  private async initializeGenerator(onProgress?: (stage: string) => void): Promise<void> {
    onProgress?.('Checking WebGPU...');

    const navigatorWithGpu = navigator as NavigatorWithWebGpu;
    if (!navigatorWithGpu.gpu) {
      throw new ModelRuntimeError('WebGPU is unavailable.', 'WEBGPU_UNAVAILABLE');
    }

    const adapter = await navigatorWithGpu.gpu.requestAdapter();
    if (!adapter) {
      throw new ModelRuntimeError('WebGPU adapter not available.', 'WEBGPU_UNAVAILABLE');
    }

    onProgress?.('Downloading model...');

    const runtime = (await pipeline('text-generation', this.model.modelId, {
      device: 'webgpu',
      dtype: this.model.dtype,
      progress_callback: (update: ProgressUpdate) => {
        if (update.status === 'progress') {
          const percent =
            typeof update.progress === 'number' ? ` (${Math.round(update.progress)}%)` : '';
          onProgress?.(`Downloading model${percent}...`);
          return;
        }

        if (typeof update.file === 'string' && update.file.length > 0) {
          onProgress?.(`Downloading ${update.file}...`);
        }
      },
    })) as unknown as GeneratorFn;

    this.generator = runtime;

    onProgress?.('Warming up model...');
    await this.generator(WARMUP_PROMPT, {
      max_new_tokens: 8,
      temperature: 0,
      top_p: 1,
      do_sample: false,
      return_full_text: false,
    });

    onProgress?.('Model ready.');
  }
}
