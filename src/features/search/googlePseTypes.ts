export interface GoogleCseUiOptions {
  overlayResults?: boolean;
}

export interface GoogleCseElement {
  clearAllResults?(): void;
  execute(query: string): void;
  uiOptions?: GoogleCseUiOptions;
}

export interface GoogleCseRenderAttributes {
  overlayResults?: boolean;
}

export interface GoogleCseRenderOptions {
  div: string;
  gname: string;
  tag: 'searchresults-only';
  linkTarget?: string;
  attributes?: GoogleCseRenderAttributes;
}

export interface GoogleCseApi {
  getElement(name: string): GoogleCseElement | null;
  getAllElements?(): GoogleCseElement[];
  go?(): void;
  render?(options: GoogleCseRenderOptions): void;
}

export type GooglePseCallback = (...args: unknown[]) => void;

export interface GooglePseWebCallbacks {
  ready?: GooglePseCallback;
  rendered?: GooglePseCallback;
  starting?: GooglePseCallback;
}

export interface GooglePseSearchCallbacks {
  web?: GooglePseWebCallbacks;
}
