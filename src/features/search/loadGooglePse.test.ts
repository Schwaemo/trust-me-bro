import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoogleCseApi, GoogleCseRenderOptions } from './googlePseTypes';
import {
  clearGooglePseResults,
  executeGooglePseQuery,
  loadGooglePse,
  PSE_RESULTS_CONTAINER_ID,
  PSE_RESULTS_ELEMENT_NAME,
  subscribeToGooglePseEvents,
} from './loadGooglePse';

const installGoogleApi = (api: GoogleCseApi) => {
  window.google = {
    search: {
      cse: {
        element: api,
      },
    },
  };
};

describe('loadGooglePse helpers', () => {
  beforeEach(() => {
    document.body.className = '';
    document.body.innerHTML = `<div id="${PSE_RESULTS_CONTAINER_ID}"></div>`;
    delete window.google;
    window.__gcse = undefined;
  });

  it('renders with inline enforcement before executing query', () => {
    const execute = vi.fn();
    let renderOptions: GoogleCseRenderOptions | null = null;

    const api: GoogleCseApi = {
      getElement: (name) => {
        if (name !== PSE_RESULTS_ELEMENT_NAME) {
          return null;
        }

        if (!renderOptions) {
          return null;
        }

        return {
          execute,
          uiOptions: {
            overlayResults: false,
          },
        };
      },
      render: (options) => {
        renderOptions = options;
      },
    };

    installGoogleApi(api);

    const result = executeGooglePseQuery('local query');

    expect(result).toEqual({ ok: true });
    expect(renderOptions).toEqual(
      expect.objectContaining({
        attributes: expect.objectContaining({
          overlayResults: false,
        }),
        div: PSE_RESULTS_CONTAINER_ID,
        gname: PSE_RESULTS_ELEMENT_NAME,
        linkTarget: '_self',
        tag: 'searchresults-only',
      }),
    );
    expect(execute).toHaveBeenCalledWith('local query');
  });

  it('rejects execution when overlay mode is enabled and clears body scroll lock', () => {
    const execute = vi.fn();
    const mountNode = document.getElementById(PSE_RESULTS_CONTAINER_ID);
    if (!mountNode) {
      throw new Error('missing mount node');
    }
    mountNode.innerHTML = '<div class="gsc-control-cse"></div>';
    document.body.classList.add('gsc-overflow-hidden');

    installGoogleApi({
      getElement: () => ({
        execute,
        uiOptions: {
          overlayResults: true,
        },
      }),
    });

    const result = executeGooglePseQuery('overlay query');

    expect(result).toEqual({
      ok: false,
      reason: 'OVERLAY_RESULTS_ENABLED',
    });
    expect(execute).not.toHaveBeenCalled();
    expect(document.body.classList.contains('gsc-overflow-hidden')).toBe(false);
  });

  it('returns EXECUTION_FAILED when PSE execute throws', () => {
    const mountNode = document.getElementById(PSE_RESULTS_CONTAINER_ID);
    if (!mountNode) {
      throw new Error('missing mount node');
    }
    mountNode.innerHTML = '<div class="gsc-control-cse"></div>';

    installGoogleApi({
      getElement: () => ({
        execute: () => {
          throw new DOMException('Blocked', 'SecurityError');
        },
        uiOptions: {
          overlayResults: false,
        },
      }),
    });

    const result = executeGooglePseQuery('query');

    expect(result).toEqual({
      ok: false,
      reason: 'EXECUTION_FAILED',
    });
  });

  it('clears rendered results using API and DOM fallback', () => {
    const clearAllResults = vi.fn();
    const mountNode = document.getElementById(PSE_RESULTS_CONTAINER_ID);
    if (!mountNode) {
      throw new Error('missing mount node');
    }

    mountNode.innerHTML = '<div>existing result node</div>';
    installGoogleApi({
      getElement: () => ({
        clearAllResults,
        execute: vi.fn(),
      }),
    });

    clearGooglePseResults();

    expect(clearAllResults).toHaveBeenCalledTimes(1);
    expect(mountNode.innerHTML).toBe('');
  });

  it('re-renders when element exists in memory but results DOM was cleared', () => {
    const mountNode = document.getElementById(PSE_RESULTS_CONTAINER_ID);
    if (!mountNode) {
      throw new Error('missing mount node');
    }

    mountNode.innerHTML = '';
    const execute = vi.fn();
    const render = vi.fn(() => {
      mountNode.innerHTML = '<div class="gsc-control-cse"></div>';
    });

    installGoogleApi({
      getElement: () => ({
        execute,
        uiOptions: {
          overlayResults: false,
        },
      }),
      render,
    });

    const result = executeGooglePseQuery('second query');

    expect(result).toEqual({ ok: true });
    expect(render).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith('second query');
  });

  it('emits callback events with normalized query values', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToGooglePseEvents(listener);

    installGoogleApi({
      getElement: () => null,
    });

    await loadGooglePse('test-cse-id');

    window.__gcse?.searchCallbacks?.web?.ready?.({ q: '   react   query   ' });
    window.__gcse?.searchCallbacks?.web?.rendered?.('vue');

    expect(listener).toHaveBeenNthCalledWith(1, {
      query: 'react query',
      type: 'ready',
    });
    expect(listener).toHaveBeenNthCalledWith(2, {
      query: 'vue',
      type: 'rendered',
    });

    unsubscribe();
  });
});
