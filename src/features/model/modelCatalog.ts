import type { ModelMode } from '../../state/types';

export interface ModelCatalogEntry {
  dtype: 'q4f16';
  displayName: string;
  modelId: string;
  mode: ModelMode;
}

const MODEL_CATALOG: Record<ModelMode, ModelCatalogEntry> = {
  basic: {
    mode: 'basic',
    displayName: 'Gemma 3 270 (Basic)',
    modelId: 'onnx-community/gemma-3-270m-it-ONNX',
    dtype: 'q4f16',
  },
  advanced: {
    mode: 'advanced',
    displayName: 'DeepSeek-R1-Distill-Qwen-1.5B (Advanced mode)',
    modelId: 'onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX',
    dtype: 'q4f16',
  },
};

export const getModelCatalogEntry = (mode: ModelMode): ModelCatalogEntry => MODEL_CATALOG[mode];
