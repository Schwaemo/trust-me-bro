# Standalone Search Website with In-Browser AI Overview

A static React + TypeScript + Vite app that provides:

- An **AI Overview** generated locally in-browser (query-only input).
- **Google Programmable Search Engine (PSE)** results rendered below the overview.

No accounts, no backend API, and no custom persistence of user query/output.

## MVP Scope Implemented

- React + TypeScript + Vite static app scaffold.
- Explicit UI states:
  - model: `loading | ready | error`
  - generation: `idle | generating | success | error`
- Submit disabled until the selected model is ready.
- Home-only model mode toggle:
  - `Gemma 3 270 (Basic)`
  - `DeepSeek-R1-Distill-Qwen-1.5B (Advanced mode)`
- Google PSE script integration + programmatic query execution.
- Retry paths for model load and generation errors.
- Stateless/privacy constraints with no query/output storage.
- Unit tests + Playwright smoke e2e tests.

## Runtime + Model Decision (Pinned)

- Runtime library: `@huggingface/transformers@3.8.1`
- Models:
  - `onnx-community/gemma-3-270m-it-ONNX` (Basic)
  - `onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX` (Advanced)
- Device target: WebGPU (`Chrome/Edge` expected for MVP support)
- Quantization setting: `q4f16`
- Runtime behavior: lazy active-only loading (the selected mode is loaded on demand; no dual-model memory cache).

## Dependency Versions

- `react@19.2.4`
- `react-dom@19.2.4`
- `vite@7.3.1`
- `typescript@5.9.3`
- `@vitejs/plugin-react@5.1.4`
- `eslint@10.0.0`
- `@typescript-eslint/parser@8.56.0`
- `@typescript-eslint/eslint-plugin@8.56.0`
- `eslint-plugin-react-hooks@7.0.1`
- `eslint-plugin-react-refresh@0.5.0`
- `prettier@3.8.1`
- `vitest@4.0.18`
- `@testing-library/react@16.3.2`
- `@testing-library/jest-dom@6.9.1`
- `jsdom@28.1.0`
- `@playwright/test@1.58.2`

## Environment Variables

Create a local `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Required:

```bash
VITE_GOOGLE_CSE_ID=your_google_cse_id
```

## Local Run

Install dependencies:

```bash
npm install --legacy-peer-deps
```

Run development server:

```bash
npm run dev
```

### Quality Commands

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
```

## Architecture Overview

- `src/features/model/modelCatalog.ts`: model IDs, labels, and quantization config by mode.
- `src/features/model/gemmaRuntime.ts`: WebGPU check, model load, warm-up, generation.
- `src/features/overview/prompt.ts`: exact prompt instruction and query-only prompt build.
- `src/features/overview/postprocess.ts`: sentence/word guardrails and plain text cleanup.
- `src/features/search/loadGooglePse.ts`: PSE script loader + `execute(query)` bridge.
- `src/state/useSearchController.ts`: orchestration and app state transitions.

## Browser Support

- Supported MVP path: latest Chromium browsers (`Chrome`, `Edge`) with WebGPU support.
- Non-WebGPU environments show a clear unsupported/error state and cannot generate overviews.

## Privacy Behavior

- Overview generation runs locally in the browser.
- No backend service receives generation prompts or outputs.
- No custom storage of query/output in localStorage, sessionStorage, IndexedDB, DB, or server logs.
- Search results are provided via Google PSE embed behavior.

## GitHub Pages Deployment

1. In GitHub, add a repository secret named `VITE_GOOGLE_CSE_ID` with your Google Programmable Search Engine ID.
2. In `Settings -> Pages`, set `Source` to `GitHub Actions`.
3. Push to `main`, or run the `Deploy GitHub Pages` workflow manually from the Actions tab.
4. Wait for the workflow to publish the `dist/` artifact to GitHub Pages.
5. Open `https://schwaemo.github.io/trust-me-bro/`.

### Production Notes

- Production builds use the base path `/trust-me-bro/`.
- If this repository is renamed, update the Vite base path in `vite.config.ts` before deploying again.
- Local development stays on `/`, so `npm run dev` behavior is unchanged.

### Production Verification Checklist

- Site is served over HTTPS.
- Site loads from `https://schwaemo.github.io/trust-me-bro/`.
- Selected model mode loads and can generate overview text.
- Home-only toggle switches between Basic and Advanced modes.
- Google PSE script loads and results execute per query.
- Favicon, JS, CSS, and ONNX/WASM assets load without 404 errors.
- No console errors that break the main flow.

## Limitations

- First-load model download and warm-up can be slow on weak hardware/networks.
- Advanced mode has a substantially larger download and memory footprint than Basic mode.
- Google PSE rendering/styling is constrained by embed behavior.
- Response correctness is not guaranteed; disclaimer remains visible in UI.
