import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createModelRuntime } from '../features/model/createRuntime';
import { ModelRuntimeError } from '../features/model/gemmaRuntime';
import { getModelCatalogEntry } from '../features/model/modelCatalog';
import {
  clearGooglePseResults,
  executeGooglePseQuery,
  loadGooglePse,
  subscribeToGooglePseEvents,
  type GooglePseEvent,
  type GooglePseExecuteFailureReason,
  type GooglePseExecuteResult,
} from '../features/search/loadGooglePse';
import type {
  GenerationStatus,
  ModelErrorCode,
  ModelMode,
  ModelRuntime,
  ModelStatus,
  PseStatus,
} from './types';

interface UseSearchControllerDependencies {
  clearPseResults?: () => void;
  executePse?: (query: string) => GooglePseExecuteResult;
  googleCseId?: string;
  loadPse?: (cseId: string) => Promise<void>;
  runtime?: ModelRuntime;
  runtimeFactory?: (mode: ModelMode) => ModelRuntime;
  subscribePseEvents?: (listener: (event: GooglePseEvent) => void) => () => void;
}

export interface SearchControllerState {
  canSubmit: boolean;
  generationErrorMessage: string | null;
  generationStatus: GenerationStatus;
  isCseConfigured: boolean;
  lastGeneratedModelMode: ModelMode | null;
  lastPseQuery: string;
  modelErrorMessage: string | null;
  modelStage: string;
  modelStatus: ModelStatus;
  overviewText: string;
  pseErrorMessage: string | null;
  pseReady: boolean;
  pseStatus: PseStatus;
  query: string;
  retryGeneration: () => Promise<void>;
  retryModelLoad: () => Promise<void>;
  selectedModelMode: ModelMode;
  setModelMode: (nextModelMode: ModelMode) => void;
  setQuery: (nextQuery: string) => void;
  submit: () => Promise<void>;
  submittedQuery: string;
}

const defaultModelMode: ModelMode = 'basic';
const defaultGenerationErrorMessage = 'Could not generate overview.';
const defaultPseErrorMessage = 'Search results failed to load.';
const missingCseErrorMessage = 'Search results are unavailable: missing VITE_GOOGLE_CSE_ID.';
const webGpuErrorMessage = 'WebGPU is unavailable. Use Chrome or Edge with WebGPU enabled.';
const overlayResultsEnabledMessage =
  'Search results are configured as a popup. In Google Programmable Search Engine, set Look and feel to "Results only", then save and publish.';

const normalizeQuery = (query: string): string => query.trim().replace(/\s+/g, ' ');

const getDefaultModelErrorMessage = (modelDisplayName: string): string =>
  `Could not load ${modelDisplayName}. Please try again.`;

const getErrorCode = (error: unknown): ModelErrorCode | null => {
  if (error instanceof ModelRuntimeError) {
    return error.code;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code as ModelErrorCode;
  }

  return null;
};

const getPseFailureMessage = (reason: GooglePseExecuteFailureReason): string => {
  if (reason === 'OVERLAY_RESULTS_ENABLED') {
    return overlayResultsEnabledMessage;
  }

  if (reason === 'EXECUTION_FAILED') {
    return 'Search results execution failed. Please retry.';
  }

  return defaultPseErrorMessage;
};

export const useSearchController = (
  dependencies: UseSearchControllerDependencies = {},
): SearchControllerState => {
  const googleCseId = dependencies.googleCseId ?? import.meta.env.VITE_GOOGLE_CSE_ID ?? '';
  const loadPse = dependencies.loadPse ?? loadGooglePse;
  const executePse = dependencies.executePse ?? executeGooglePseQuery;
  const subscribePseEvents = dependencies.subscribePseEvents ?? subscribeToGooglePseEvents;
  const clearPseResults = dependencies.clearPseResults ?? clearGooglePseResults;

  const [selectedModelMode, setSelectedModelMode] = useState<ModelMode>(defaultModelMode);
  const selectedModel = useMemo(
    () => getModelCatalogEntry(selectedModelMode),
    [selectedModelMode],
  );

  const runtimeFactory = useMemo(() => {
    if (dependencies.runtimeFactory) {
      return dependencies.runtimeFactory;
    }

    return (mode: ModelMode) => dependencies.runtime ?? createModelRuntime(mode);
  }, [dependencies.runtime, dependencies.runtimeFactory]);

  const runtime = useMemo(() => runtimeFactory(selectedModelMode), [runtimeFactory, selectedModelMode]);

  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [modelStatus, setModelStatus] = useState<ModelStatus>('loading');
  const [modelStage, setModelStage] = useState(
    `Loading ${getModelCatalogEntry(defaultModelMode).displayName}...`,
  );
  const [modelErrorMessage, setModelErrorMessage] = useState<string | null>(null);

  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>('idle');
  const [overviewText, setOverviewText] = useState('');
  const [generationErrorMessage, setGenerationErrorMessage] = useState<string | null>(null);
  const [lastGeneratedModelMode, setLastGeneratedModelMode] = useState<ModelMode | null>(null);

  const [pseReady, setPseReady] = useState(false);
  const [pseStatus, setPseStatus] = useState<PseStatus>('idle');
  const [pseErrorMessage, setPseErrorMessage] = useState<string | null>(null);
  const [lastPseQuery, setLastPseQuery] = useState('');

  const activeAbortController = useRef<AbortController | null>(null);
  const requestCounter = useRef(0);
  const activePseRequest = useRef<{ query: string; requestId: number } | null>(null);
  const staleReexecuteGuard = useRef<number | null>(null);
  const modelInitCounter = useRef(0);

  const initializeModel = useCallback(async () => {
    const initRequestId = ++modelInitCounter.current;

    setModelStatus('loading');
    setModelStage(`Loading ${selectedModel.displayName}...`);
    setModelErrorMessage(null);

    try {
      await runtime.init((stage) => {
        if (modelInitCounter.current !== initRequestId) {
          return;
        }

        setModelStage(stage);
      });

      if (modelInitCounter.current !== initRequestId) {
        return;
      }

      setModelStatus('ready');
      setModelStage('Model ready.');
    } catch (error) {
      if (modelInitCounter.current !== initRequestId) {
        return;
      }

      const code = getErrorCode(error);
      setModelStatus('error');
      setModelStage('Model unavailable.');
      setModelErrorMessage(
        code === 'WEBGPU_UNAVAILABLE'
          ? webGpuErrorMessage
          : getDefaultModelErrorMessage(selectedModel.displayName),
      );
    }
  }, [runtime, selectedModel.displayName]);

  useEffect(() => {
    void initializeModel();

    return () => {
      activeAbortController.current?.abort();
      activePseRequest.current = null;
    };
  }, [initializeModel]);

  useEffect(() => {
    if (!googleCseId.trim()) {
      setPseErrorMessage(missingCseErrorMessage);
      setPseReady(false);
      setPseStatus('idle');
      return;
    }

    let isDisposed = false;

    const preparePse = async () => {
      try {
        await loadPse(googleCseId);
        if (!isDisposed) {
          setPseReady(true);
          setPseErrorMessage(null);
        }
      } catch {
        if (!isDisposed) {
          setPseReady(false);
          setPseStatus('error');
          setPseErrorMessage(defaultPseErrorMessage);
        }
      }
    };

    void preparePse();

    return () => {
      isDisposed = true;
    };
  }, [googleCseId, loadPse]);

  useEffect(() => {
    return subscribePseEvents((event) => {
      if (event.type !== 'ready' && event.type !== 'rendered') {
        return;
      }

      const currentRequest = activePseRequest.current;
      if (!currentRequest || requestCounter.current !== currentRequest.requestId) {
        return;
      }

      const callbackQuery = normalizeQuery(event.query ?? '');
      if (callbackQuery && callbackQuery === currentRequest.query) {
        setPseStatus('success');
        setPseErrorMessage(null);
        setLastPseQuery(currentRequest.query);
        staleReexecuteGuard.current = null;
        return;
      }

      if (staleReexecuteGuard.current === currentRequest.requestId) {
        return;
      }

      staleReexecuteGuard.current = currentRequest.requestId;
      const executeResult = executePse(currentRequest.query);
      if (!executeResult.ok) {
        setPseStatus('error');
        setPseErrorMessage(getPseFailureMessage(executeResult.reason));
        setLastPseQuery('');
      }
    });
  }, [executePse, subscribePseEvents]);

  const runGenerationAndSearch = useCallback(
    async (queryToSubmit: string) => {
      if (modelStatus !== 'ready') {
        return;
      }

      const normalizedQuery = normalizeQuery(queryToSubmit);
      if (!normalizedQuery) {
        return;
      }

      requestCounter.current += 1;
      const requestId = requestCounter.current;
      staleReexecuteGuard.current = null;

      setSubmittedQuery(normalizedQuery);
      setGenerationStatus('generating');
      setGenerationErrorMessage(null);
      setOverviewText('');

      clearPseResults();
      setLastPseQuery('');
      setPseErrorMessage(null);

      if (!googleCseId.trim()) {
        activePseRequest.current = null;
        setPseStatus('idle');
        setPseErrorMessage(missingCseErrorMessage);
      } else {
        activePseRequest.current = { query: normalizedQuery, requestId };
        setPseStatus('loading');
      }

      activeAbortController.current?.abort();
      const abortController = new AbortController();
      activeAbortController.current = abortController;

      if (googleCseId.trim()) {
        const executeResult = executePse(normalizedQuery);
        if (!executeResult.ok && requestCounter.current === requestId) {
          activePseRequest.current = null;
          setPseStatus('error');
          setPseErrorMessage(getPseFailureMessage(executeResult.reason));
        }
      }

      let generationResult;
      try {
        generationResult = await runtime.generate(normalizedQuery, abortController.signal);
      } catch (error) {
        if (requestCounter.current !== requestId) {
          return;
        }

        const code = getErrorCode(error);
        if (code === 'CANCELLED') {
          setGenerationStatus('idle');
          setGenerationErrorMessage(null);
          return;
        }

        setGenerationStatus('error');
        setGenerationErrorMessage(defaultGenerationErrorMessage);
        return;
      }

      if (requestCounter.current !== requestId) {
        return;
      }

      setOverviewText(generationResult.text);
      setGenerationStatus('success');
      setLastGeneratedModelMode(selectedModelMode);
    },
    [clearPseResults, executePse, googleCseId, modelStatus, runtime, selectedModelMode],
  );

  const submit = useCallback(async () => {
    await runGenerationAndSearch(query);
  }, [query, runGenerationAndSearch]);

  const retryGeneration = useCallback(async () => {
    const fallbackQuery = submittedQuery || query;
    await runGenerationAndSearch(fallbackQuery);
  }, [query, runGenerationAndSearch, submittedQuery]);

  const retryModelLoad = useCallback(async () => {
    await initializeModel();
  }, [initializeModel]);

  const setModelMode = useCallback(
    (nextModelMode: ModelMode) => {
      if (nextModelMode === selectedModelMode) {
        return;
      }

      const nextModel = getModelCatalogEntry(nextModelMode);

      requestCounter.current += 1;
      activeAbortController.current?.abort();
      activePseRequest.current = null;
      staleReexecuteGuard.current = null;

      setGenerationErrorMessage(null);
      setGenerationStatus((currentStatus) => (currentStatus === 'success' ? 'success' : 'idle'));

      setPseStatus('idle');
      setPseErrorMessage(null);
      setLastPseQuery('');

      setModelStatus('loading');
      setModelStage(`Loading ${nextModel.displayName}...`);
      setModelErrorMessage(null);
      setSelectedModelMode(nextModelMode);
    },
    [selectedModelMode],
  );

  const canSubmit = modelStatus === 'ready' && query.trim().length > 0;

  return {
    canSubmit,
    generationErrorMessage,
    generationStatus,
    isCseConfigured: googleCseId.trim().length > 0,
    lastGeneratedModelMode,
    lastPseQuery,
    modelErrorMessage,
    modelStage,
    modelStatus,
    overviewText,
    pseErrorMessage,
    pseReady,
    pseStatus,
    query,
    retryGeneration,
    retryModelLoad,
    selectedModelMode,
    setModelMode,
    setQuery,
    submit,
    submittedQuery,
  };
};
