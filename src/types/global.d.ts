import type { GoogleCseApi, GooglePseSearchCallbacks } from '../features/search/googlePseTypes';

declare global {
  interface Window {
    __gcse?: {
      parsetags?: 'explicit' | 'onload';
      searchCallbacks?: GooglePseSearchCallbacks;
    };
    google?: {
      search?: {
        cse?: {
          element?: GoogleCseApi;
        };
      };
    };
  }
}

export {};
