import type { GoogleCseElement, GooglePseCallback, GooglePseWebCallbacks } from './googlePseTypes';

let googlePseLoader: Promise<void> | null = null;
const googlePseListeners = new Set<GooglePseEventListener>();
let lastExecutedQuery = '';
let callbacksInstalled = false;

export const PSE_RESULTS_ELEMENT_NAME = 'trustmebro-results';
export const PSE_RESULTS_CONTAINER_ID = 'trustmebro-results-container';

export type GooglePseEventType = 'starting' | 'ready' | 'rendered';
export interface GooglePseEvent {
  query: string | null;
  type: GooglePseEventType;
}

export type GooglePseEventListener = (event: GooglePseEvent) => void;

export type GooglePseExecuteFailureReason =
  | 'EMPTY_QUERY'
  | 'RESULTS_ELEMENT_UNAVAILABLE'
  | 'OVERLAY_RESULTS_ENABLED'
  | 'EXECUTION_FAILED';

export type GooglePseExecuteResult =
  | { ok: true }
  | { ok: false; reason: GooglePseExecuteFailureReason };

const normalizeQuery = (query: string): string => query.trim().replace(/\s+/g, ' ');

const emitGooglePseEvent = (type: GooglePseEventType, callbackArgs: unknown[]) => {
  const query = extractQueryFromCallbackArgs(callbackArgs);
  const payload: GooglePseEvent = {
    query: query ?? (lastExecutedQuery || null),
    type,
  };

  googlePseListeners.forEach((listener) => {
    listener(payload);
  });
};

const extractQueryFromCallbackArgs = (callbackArgs: unknown[]): string | null => {
  for (const value of callbackArgs) {
    if (typeof value === 'string') {
      const normalized = normalizeQuery(value);
      if (normalized) {
        return normalized;
      }
    }

    if (typeof value === 'object' && value !== null && 'q' in value) {
      const query = value.q;
      if (typeof query === 'string') {
        const normalized = normalizeQuery(query);
        if (normalized) {
          return normalized;
        }
      }
    }
  }

  return null;
};

const composeCallback =
  (eventType: GooglePseEventType, existing?: GooglePseCallback): GooglePseCallback =>
    (...args: unknown[]) => {
      existing?.(...args);
      emitGooglePseEvent(eventType, args);
    };

const installSearchCallbacks = () => {
  if (callbacksInstalled) {
    return;
  }

  const existingGcse = window.__gcse ?? {};
  const existingSearchCallbacks = existingGcse.searchCallbacks ?? {};
  const existingWebCallbacks = existingSearchCallbacks.web ?? {};

  const webCallbacks: GooglePseWebCallbacks = {
    ...existingWebCallbacks,
    starting: composeCallback('starting', existingWebCallbacks.starting),
    ready: composeCallback('ready', existingWebCallbacks.ready),
    rendered: composeCallback('rendered', existingWebCallbacks.rendered),
  };

  window.__gcse = {
    ...existingGcse,
    parsetags: 'explicit',
    searchCallbacks: {
      ...existingSearchCallbacks,
      web: webCallbacks,
    },
  };

  callbacksInstalled = true;
};

const waitForElementApi = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const timeoutMs = 10_000;
    const started = Date.now();

    const poll = () => {
      if (window.google?.search?.cse?.element) {
        resolve();
        return;
      }

      if (Date.now() - started > timeoutMs) {
        reject(new Error('Google PSE failed to initialize.'));
        return;
      }

      window.setTimeout(poll, 50);
    };

    poll();
  });
};

export const subscribeToGooglePseEvents = (
  listener: GooglePseEventListener,
): (() => void) => {
  googlePseListeners.add(listener);
  return () => {
    googlePseListeners.delete(listener);
  };
};

export const loadGooglePse = async (cseId: string): Promise<void> => {
  if (!cseId.trim()) {
    throw new Error('Missing VITE_GOOGLE_CSE_ID.');
  }

  installSearchCallbacks();

  if (window.google?.search?.cse?.element) {
    return;
  }

  if (!googlePseLoader) {
    googlePseLoader = new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[data-google-pse="true"]',
      );

      if (existingScript) {
        void waitForElementApi().then(resolve).catch(reject);
        return;
      }

      const script = document.createElement('script');
      script.async = true;
      script.defer = true;
      script.dataset.googlePse = 'true';
      script.src = `https://cse.google.com/cse.js?cx=${encodeURIComponent(cseId)}`;

      script.addEventListener('load', () => {
        void waitForElementApi().then(resolve).catch(reject);
      });

      script.addEventListener('error', () => {
        reject(new Error('Failed to load Google PSE script.'));
      });

      document.head.appendChild(script);
    });
  }

  try {
    await googlePseLoader;
  } catch (error) {
    googlePseLoader = null;
    throw error;
  }
};

const ensureSearchResultsElement = (): GoogleCseElement | null => {
  const elementApi = window.google?.search?.cse?.element;
  if (!elementApi) {
    return null;
  }

  const mountNode = document.getElementById(PSE_RESULTS_CONTAINER_ID);

  // If the container is effectively empty (cleared/wiped), we must force a re-render
  // because the existing element reference points to a detached or destroyed DOM node.
  const isContainerPopulated = mountNode && mountNode.childElementCount > 0;

  if (isContainerPopulated) {
    const existingElement = elementApi.getElement(PSE_RESULTS_ELEMENT_NAME);
    if (existingElement) {
      return existingElement;
    }
  }

  if (!mountNode || !elementApi.render) {
    return null;
  }

  try {
    elementApi.render({
      div: PSE_RESULTS_CONTAINER_ID,
      gname: PSE_RESULTS_ELEMENT_NAME,
      tag: 'searchresults-only',
      linkTarget: '_self',
      attributes: {
        overlayResults: false,
      },
    });
  } catch {
    return null;
  }

  return elementApi.getElement(PSE_RESULTS_ELEMENT_NAME);
};

const hasOverlayResultsEnabled = (element: GoogleCseElement): boolean => {
  return element.uiOptions?.overlayResults === true;
};

const clearOverlayScrollLock = () => {
  document.body.classList.remove('gsc-overflow-hidden');
};

const clearResultsContainer = () => {
  const mountNode = document.getElementById(PSE_RESULTS_CONTAINER_ID);
  if (mountNode) {
    mountNode.innerHTML = '';
  }
};

export const clearGooglePseResults = () => {
  const element = window.google?.search?.cse?.element?.getElement(PSE_RESULTS_ELEMENT_NAME);

  try {
    element?.clearAllResults?.();
  } catch {
    // Ignore clear errors from PSE internals and keep UI stable via DOM fallback.
  }

  clearOverlayScrollLock();
  clearResultsContainer();
};

export const executeGooglePseQuery = (query: string): GooglePseExecuteResult => {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    return {
      ok: false,
      reason: 'EMPTY_QUERY',
    };
  }

  const element = ensureSearchResultsElement();
  if (!element) {
    return {
      ok: false,
      reason: 'RESULTS_ELEMENT_UNAVAILABLE',
    };
  }

  if (hasOverlayResultsEnabled(element)) {
    clearOverlayScrollLock();
    return {
      ok: false,
      reason: 'OVERLAY_RESULTS_ENABLED',
    };
  }

  try {
    lastExecutedQuery = normalizedQuery;
    element.execute(normalizedQuery);
    return { ok: true };
  } catch {
    clearOverlayScrollLock();
    return {
      ok: false,
      reason: 'EXECUTION_FAILED',
    };
  }
};
