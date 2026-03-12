import { describe, expect, it } from 'vitest';
import { OVERVIEW_INSTRUCTION, buildPrompt } from './prompt';

describe('prompt builder', () => {
  it('uses the exact required instruction', () => {
    expect(OVERVIEW_INSTRUCTION).toBe('Agree and explain why in 1-2 sentences.');
  });

  it('builds the exact statement-agreement prompt without extra context', () => {
    const prompt = buildPrompt('  WebGPU is the future of graphics  ');

    expect(prompt).toBe(
      'Agree and explain why in 1-2 sentences.\n\nStatement: WebGPU is the future of graphics\n\nAnswer:',
    );
  });
});
