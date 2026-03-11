export type AppTestMode = 'off' | 'mock-ready' | 'mock-init-error' | 'mock-generation-error';

export const getTestMode = (): AppTestMode => {
  if (typeof window === 'undefined') {
    return 'off';
  }

  const mode = new URLSearchParams(window.location.search).get('testMode');

  if (mode === 'mock-ready') {
    return 'mock-ready';
  }

  if (mode === 'mock-init-error') {
    return 'mock-init-error';
  }

  if (mode === 'mock-generation-error') {
    return 'mock-generation-error';
  }

  return 'off';
};
