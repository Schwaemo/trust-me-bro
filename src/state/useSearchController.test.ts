import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GooglePseEvent, GooglePseExecuteResult } from '../features/search/loadGooglePse';
import type { GenerationResult, ModelErrorCode, ModelMode, ModelRuntime } from './types';
import { useSearchController } from './useSearchController';

const normalizeQuery = (query: string): string => query.trim().replace(/\s+/g, ' ');

const createErrorWithCode = (code: ModelErrorCode): Error & { code: ModelErrorCode } => {
  const error = new Error(code) as Error & { code: ModelErrorCode };
  error.code = code;
  return error;
};

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, reject, resolve };
};

class MockRuntime implements ModelRuntime {
  private readonly initImpl: () => Promise<void>;
  private readonly generateImpl: (query: string, signal: AbortSignal) => Promise<GenerationResult>;

  constructor(options?: {
    generateImpl?: (query: string, signal: AbortSignal) => Promise<GenerationResult>;
    initImpl?: () => Promise<void>;
  }) {
    this.initImpl = options?.initImpl ?? (async () => Promise.resolve());
    this.generateImpl =
      options?.generateImpl ??
      (async (query: string) => ({
        text: `response for ${query}`,
        elapsedMs: 25,
      }));
  }

  async init(): Promise<void> {
    await this.initImpl();
  }

  async generate(query: string, signal: AbortSignal): Promise<GenerationResult> {
    if (signal.aborted) {
      throw createErrorWithCode('CANCELLED');
    }

    return this.generateImpl(query, signal);
  }
}

const createModeRuntimeFactory = (options?: {
  advancedGenerateImpl?: (query: string, signal: AbortSignal) => Promise<GenerationResult>;
  advancedInitImpl?: () => Promise<void>;
  basicGenerateImpl?: (query: string, signal: AbortSignal) => Promise<GenerationResult>;
  basicInitImpl?: () => Promise<void>;
}) => {
  const basicRuntime = new MockRuntime({
    initImpl: options?.basicInitImpl,
    generateImpl: options?.basicGenerateImpl,
  });
  const advancedRuntime = new MockRuntime({
    initImpl: options?.advancedInitImpl,
    generateImpl: options?.advancedGenerateImpl,
  });

  const runtimeFactory = vi.fn((mode: ModelMode) =>
    mode === 'basic' ? basicRuntime : advancedRuntime,
  );

  return {
    advancedRuntime,
    basicRuntime,
    runtimeFactory,
  };
};

const createPseHarness = (options?: { autoEmitOnExecute?: boolean }) => {
  const listeners = new Set<(event: GooglePseEvent) => void>();
  const clearPseResults = vi.fn();
  const autoEmitOnExecute = options?.autoEmitOnExecute ?? true;

  const emit = (event: GooglePseEvent) => {
    listeners.forEach((listener) => {
      listener(event);
    });
  };

  const executePse = vi.fn((query: string): GooglePseExecuteResult => {
    const normalizedQuery = normalizeQuery(query);
    if (autoEmitOnExecute) {
      queueMicrotask(() => {
        emit({
          query: normalizedQuery,
          type: 'ready',
        });
      });
    }
    return { ok: true };
  });

  const subscribePseEvents = (listener: (event: GooglePseEvent) => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    clearPseResults,
    emit,
    executePse,
    subscribePseEvents,
  };
};

describe('useSearchController', () => {
  it('moves from loading to ready after init', async () => {
    const runtime = new MockRuntime();
    const pseHarness = createPseHarness();

    const { result } = renderHook(() =>
      useSearchController({
        clearPseResults: pseHarness.clearPseResults,
        executePse: pseHarness.executePse,
        googleCseId: 'test-cse',
        loadPse: async () => Promise.resolve(),
        runtime,
        subscribePseEvents: pseHarness.subscribePseEvents,
      }),
    );

    expect(result.current.modelStatus).toBe('loading');
    expect(result.current.selectedModelMode).toBe('basic');
    expect(result.current.lastGeneratedModelMode).toBeNull();

    await waitFor(() => {
      expect(result.current.modelStatus).toBe('ready');
    });
    await waitFor(() => {
      expect(result.current.pseReady).toBe(true);
    });
  });

  it('switches from basic to advanced mode and initializes the advanced runtime', async () => {
    const basicInit = vi.fn(async () => Promise.resolve());
    const advancedInit = vi.fn(async () => Promise.resolve());
    const pseHarness = createPseHarness();
    const runtimeByMode = createModeRuntimeFactory({
      advancedInitImpl: advancedInit,
      basicInitImpl: basicInit,
    });

    const { result } = renderHook(() =>
      useSearchController({
        clearPseResults: pseHarness.clearPseResults,
        executePse: pseHarness.executePse,
        googleCseId: 'test-cse',
        loadPse: async () => Promise.resolve(),
        runtimeFactory: runtimeByMode.runtimeFactory,
        subscribePseEvents: pseHarness.subscribePseEvents,
      }),
    );

    await waitFor(() => {
      expect(result.current.modelStatus).toBe('ready');
    });
    expect(result.current.selectedModelMode).toBe('basic');

    act(() => {
      result.current.setModelMode('advanced');
    });

    expect(result.current.selectedModelMode).toBe('advanced');
    expect(result.current.modelStatus).toBe('loading');

    await waitFor(() => {
      expect(result.current.modelStatus).toBe('ready');
    });

    expect(runtimeByMode.runtimeFactory).toHaveBeenCalledWith('basic');
    expect(runtimeByMode.runtimeFactory).toHaveBeenCalledWith('advanced');
    expect(basicInit).toHaveBeenCalledTimes(1);
    expect(advancedInit).toHaveBeenCalledTimes(1);
  });

  it('keeps existing overview text until submit after switching model mode', async () => {
    const advancedGenerate = vi.fn(
      async (query: string): Promise<GenerationResult> => ({
        text: `advanced response for ${query}`,
        elapsedMs: 12,
      }),
    );
    const pseHarness = createPseHarness();
    const runtimeByMode = createModeRuntimeFactory({
      advancedGenerateImpl: advancedGenerate,
      basicGenerateImpl: async (query: string) => ({
        text: `basic response for ${query}`,
        elapsedMs: 11,
      }),
    });

    const { result } = renderHook(() =>
      useSearchController({
        clearPseResults: pseHarness.clearPseResults,
        executePse: pseHarness.executePse,
        googleCseId: 'test-cse',
        loadPse: async () => Promise.resolve(),
        runtimeFactory: runtimeByMode.runtimeFactory,
        subscribePseEvents: pseHarness.subscribePseEvents,
      }),
    );

    await waitFor(() => {
      expect(result.current.modelStatus).toBe('ready');
    });

    act(() => {
      result.current.setQuery('local model');
    });

    await act(async () => {
      await result.current.submit();
    });

    await waitFor(() => {
      expect(result.current.generationStatus).toBe('success');
    });
    expect(result.current.overviewText).toBe('basic response for local model');
    expect(result.current.lastGeneratedModelMode).toBe('basic');

    act(() => {
      result.current.setModelMode('advanced');
    });

    expect(result.current.selectedModelMode).toBe('advanced');
    expect(result.current.overviewText).toBe('basic response for local model');
    expect(result.current.generationStatus).toBe('success');
    expect(result.current.lastGeneratedModelMode).toBe('basic');
    expect(advancedGenerate).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(result.current.modelStatus).toBe('ready');
    });
  });

  it('submits query and updates overview and PSE query marker', async () => {
    const runtime = new MockRuntime();
    const pseHarness = createPseHarness();

    const { result } = renderHook(() =>
      useSearchController({
        clearPseResults: pseHarness.clearPseResults,
        executePse: pseHarness.executePse,
        googleCseId: 'test-cse',
        loadPse: async () => Promise.resolve(),
        runtime,
        subscribePseEvents: pseHarness.subscribePseEvents,
      }),
    );

    await waitFor(() => {
      expect(result.current.modelStatus).toBe('ready');
    });

    act(() => {
      result.current.setQuery('what is gemma');
    });

    await act(async () => {
      await result.current.submit();
    });

    await waitFor(() => {
      expect(result.current.lastPseQuery).toBe('what is gemma');
    });

    expect(pseHarness.executePse).toHaveBeenCalledWith('what is gemma');
    expect(result.current.generationStatus).toBe('success');
    expect(result.current.overviewText).toContain('what is gemma');
    expect(result.current.lastGeneratedModelMode).toBe('basic');
    expect(result.current.pseStatus).toBe('success');
  });

  it('clears overview and PSE state immediately on new submission', async () => {
    const secondDeferred = deferred<GenerationResult>();
    const pseHarness = createPseHarness({ autoEmitOnExecute: false });
    const runtime = new MockRuntime({
      generateImpl: async (query) => {
        if (query === 'vue') {
          return secondDeferred.promise;
        }

        return {
          text: `response for ${query}`,
          elapsedMs: 10,
        };
      },
    });

    const { result: delayedResult } = renderHook(() =>
      useSearchController({
        clearPseResults: pseHarness.clearPseResults,
        executePse: pseHarness.executePse,
        googleCseId: 'test-cse',
        loadPse: async () => Promise.resolve(),
        runtime,
        subscribePseEvents: pseHarness.subscribePseEvents,
      }),
    );

    await waitFor(() => {
      expect(delayedResult.current.modelStatus).toBe('ready');
    });

    act(() => {
      delayedResult.current.setQuery('react');
    });
    await act(async () => {
      await delayedResult.current.submit();
    });
    act(() => {
      pseHarness.emit({
        query: 'react',
        type: 'ready',
      });
    });
    await waitFor(() => {
      expect(delayedResult.current.lastPseQuery).toBe('react');
    });

    act(() => {
      delayedResult.current.setQuery('vue');
    });

    await act(async () => {
      void delayedResult.current.submit();
    });

    expect(delayedResult.current.generationStatus).toBe('generating');
    expect(delayedResult.current.overviewText).toBe('');
    expect(delayedResult.current.lastPseQuery).toBe('');
    expect(delayedResult.current.pseStatus).toBe('loading');

    await act(async () => {
      pseHarness.emit({
        query: 'vue',
        type: 'ready',
      });
      secondDeferred.resolve({
        text: 'response for vue',
        elapsedMs: 20,
      });
      await secondDeferred.promise;
    });

    await waitFor(() => {
      expect(delayedResult.current.generationStatus).toBe('success');
    });
  });

  it('keeps latest query state under rapid submissions and ignores stale updates', async () => {
    const reactDeferred = deferred<GenerationResult>();
    const vueDeferred = deferred<GenerationResult>();
    const runtime = new MockRuntime({
      generateImpl: async (query) => {
        if (query === 'react') {
          return reactDeferred.promise;
        }

        if (query === 'vue') {
          return vueDeferred.promise;
        }

        return {
          text: `response for ${query}`,
          elapsedMs: 10,
        };
      },
    });

    const pseHarness = createPseHarness({ autoEmitOnExecute: false });

    const { result } = renderHook(() =>
      useSearchController({
        clearPseResults: pseHarness.clearPseResults,
        executePse: pseHarness.executePse,
        googleCseId: 'test-cse',
        loadPse: async () => Promise.resolve(),
        runtime,
        subscribePseEvents: pseHarness.subscribePseEvents,
      }),
    );

    await waitFor(() => {
      expect(result.current.modelStatus).toBe('ready');
    });

    act(() => {
      result.current.setQuery('react');
    });
    await act(async () => {
      void result.current.submit();
    });

    act(() => {
      result.current.setQuery('vue');
    });
    await act(async () => {
      void result.current.submit();
    });

    act(() => {
      pseHarness.emit({
        query: 'react',
        type: 'ready',
      });
    });

    await act(async () => {
      reactDeferred.resolve({
        text: 'response for react',
        elapsedMs: 20,
      });
      await reactDeferred.promise;
    });

    expect(result.current.lastPseQuery).toBe('');
    expect(result.current.overviewText).toBe('');
    expect(result.current.generationStatus).toBe('generating');

    act(() => {
      pseHarness.emit({
        query: 'vue',
        type: 'ready',
      });
    });

    await act(async () => {
      vueDeferred.resolve({
        text: 'response for vue',
        elapsedMs: 18,
      });
      await vueDeferred.promise;
    });

    await waitFor(() => {
      expect(result.current.generationStatus).toBe('success');
    });

    expect(result.current.overviewText).toBe('response for vue');
    expect(result.current.lastPseQuery).toBe('vue');
    expect(result.current.submittedQuery).toBe('vue');
  });

  it('re-executes once when stale PSE callback arrives and ignores stale query marker', async () => {
    const runtime = new MockRuntime();
    const pseHarness = createPseHarness({ autoEmitOnExecute: false });

    const { result } = renderHook(() =>
      useSearchController({
        clearPseResults: pseHarness.clearPseResults,
        executePse: pseHarness.executePse,
        googleCseId: 'test-cse',
        loadPse: async () => Promise.resolve(),
        runtime,
        subscribePseEvents: pseHarness.subscribePseEvents,
      }),
    );

    await waitFor(() => {
      expect(result.current.modelStatus).toBe('ready');
    });

    act(() => {
      result.current.setQuery('react');
    });
    await act(async () => {
      void result.current.submit();
    });

    act(() => {
      result.current.setQuery('vue');
    });
    await act(async () => {
      void result.current.submit();
    });

    act(() => {
      pseHarness.emit({
        query: 'react',
        type: 'rendered',
      });
    });

    expect(pseHarness.executePse).toHaveBeenCalledTimes(3);
    expect(pseHarness.executePse).toHaveBeenLastCalledWith('vue');
    expect(result.current.lastPseQuery).toBe('');

    act(() => {
      pseHarness.emit({
        query: 'vue',
        type: 'rendered',
      });
    });

    await waitFor(() => {
      expect(result.current.lastPseQuery).toBe('vue');
    });
    expect(result.current.pseStatus).toBe('success');
  });

  it('aborts prior generation and never commits aborted result', async () => {
    let firstAborted = false;

    const runtime = new MockRuntime({
      generateImpl: async (query, signal) => {
        if (query === 'react') {
          return new Promise<GenerationResult>((_, reject) => {
            signal.addEventListener(
              'abort',
              () => {
                firstAborted = true;
                reject(createErrorWithCode('CANCELLED'));
              },
              { once: true },
            );
          });
        }

        return {
          text: 'response for vue',
          elapsedMs: 22,
        };
      },
    });

    const pseHarness = createPseHarness();

    const { result } = renderHook(() =>
      useSearchController({
        clearPseResults: pseHarness.clearPseResults,
        executePse: pseHarness.executePse,
        googleCseId: 'test-cse',
        loadPse: async () => Promise.resolve(),
        runtime,
        subscribePseEvents: pseHarness.subscribePseEvents,
      }),
    );

    await waitFor(() => {
      expect(result.current.modelStatus).toBe('ready');
    });

    act(() => {
      result.current.setQuery('react');
    });
    await act(async () => {
      void result.current.submit();
    });

    act(() => {
      result.current.setQuery('vue');
    });
    await act(async () => {
      await result.current.submit();
    });

    await waitFor(() => {
      expect(result.current.generationStatus).toBe('success');
    });

    expect(firstAborted).toBe(true);
    expect(result.current.overviewText).toBe('response for vue');
    expect(result.current.submittedQuery).toBe('vue');
  });

  it('surfaces actionable message when CSE overlay results are enabled', async () => {
    const runtime = new MockRuntime();
    const loadPse = vi.fn(async () => Promise.resolve());
    const executePse = vi.fn(() => ({
      ok: false as const,
      reason: 'OVERLAY_RESULTS_ENABLED' as const,
    }));
    const pseHarness = createPseHarness({ autoEmitOnExecute: false });

    const { result } = renderHook(() =>
      useSearchController({
        clearPseResults: pseHarness.clearPseResults,
        executePse,
        googleCseId: 'test-cse',
        loadPse,
        runtime,
        subscribePseEvents: pseHarness.subscribePseEvents,
      }),
    );

    await waitFor(() => {
      expect(result.current.modelStatus).toBe('ready');
    });

    act(() => {
      result.current.setQuery('overlay issue');
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.pseErrorMessage).toContain('set Look and feel to "Results only"');
    expect(result.current.lastPseQuery).toBe('');
    expect(result.current.pseStatus).toBe('error');
  });

  it('surfaces generation failure and recovers on retry', async () => {
    let shouldFail = true;
    const runtime = new MockRuntime({
      generateImpl: async (query) => {
        if (shouldFail) {
          throw createErrorWithCode('GENERATION_FAILED');
        }

        return {
          text: `fixed ${query}`,
          elapsedMs: 30,
        };
      },
    });
    const pseHarness = createPseHarness();

    const { result } = renderHook(() =>
      useSearchController({
        clearPseResults: pseHarness.clearPseResults,
        executePse: pseHarness.executePse,
        googleCseId: 'test-cse',
        loadPse: async () => Promise.resolve(),
        runtime,
        subscribePseEvents: pseHarness.subscribePseEvents,
      }),
    );

    await waitFor(() => {
      expect(result.current.modelStatus).toBe('ready');
    });

    act(() => {
      result.current.setQuery('retry me');
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.generationStatus).toBe('error');

    shouldFail = false;

    await act(async () => {
      await result.current.retryGeneration();
    });

    expect(result.current.generationStatus).toBe('success');
    expect(result.current.overviewText).toContain('fixed retry me');
  });

  it('retries model load for the currently selected model mode', async () => {
    let shouldFailAdvancedInit = true;
    const basicInit = vi.fn(async () => Promise.resolve());
    const advancedInit = vi.fn(async () => {
      if (shouldFailAdvancedInit) {
        throw createErrorWithCode('MODEL_LOAD_FAILED');
      }
    });
    const runtimeByMode = createModeRuntimeFactory({
      advancedInitImpl: advancedInit,
      basicInitImpl: basicInit,
    });
    const pseHarness = createPseHarness();

    const { result } = renderHook(() =>
      useSearchController({
        clearPseResults: pseHarness.clearPseResults,
        executePse: pseHarness.executePse,
        googleCseId: 'test-cse',
        loadPse: async () => Promise.resolve(),
        runtimeFactory: runtimeByMode.runtimeFactory,
        subscribePseEvents: pseHarness.subscribePseEvents,
      }),
    );

    await waitFor(() => {
      expect(result.current.modelStatus).toBe('ready');
    });

    act(() => {
      result.current.setModelMode('advanced');
    });

    await waitFor(() => {
      expect(result.current.modelStatus).toBe('error');
    });

    shouldFailAdvancedInit = false;

    await act(async () => {
      await result.current.retryModelLoad();
    });

    await waitFor(() => {
      expect(result.current.modelStatus).toBe('ready');
    });

    expect(result.current.selectedModelMode).toBe('advanced');
    expect(basicInit).toHaveBeenCalledTimes(1);
    expect(advancedInit).toHaveBeenCalledTimes(2);
  });

  it('shows model error then recovers on retry', async () => {
    let shouldFailInit = true;
    const runtime = new MockRuntime({
      initImpl: async () => {
        if (shouldFailInit) {
          throw createErrorWithCode('MODEL_LOAD_FAILED');
        }
      },
    });
    const pseHarness = createPseHarness();

    const { result } = renderHook(() =>
      useSearchController({
        clearPseResults: pseHarness.clearPseResults,
        executePse: pseHarness.executePse,
        googleCseId: 'test-cse',
        loadPse: async () => Promise.resolve(),
        runtime,
        subscribePseEvents: pseHarness.subscribePseEvents,
      }),
    );

    await waitFor(() => {
      expect(result.current.modelStatus).toBe('error');
    });

    shouldFailInit = false;

    await act(async () => {
      await result.current.retryModelLoad();
    });

    expect(result.current.modelStatus).toBe('ready');
  });
});
