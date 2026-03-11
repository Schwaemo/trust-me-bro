import { describe, expect, it } from 'vitest';
import { enforceOverviewConstraints } from './postprocess';

describe('overview post-processing', () => {
  it('keeps only the first three sentences', () => {
    const raw = 'One sentence. Two sentence. Three sentence. Four sentence.';

    const processed = enforceOverviewConstraints(raw);

    expect(processed).toBe('One sentence. Two sentence. Three sentence.');
  });

  it('removes markdown formatting characters', () => {
    const raw = '**Bold** and `code` with [link](https://example.com).';

    const processed = enforceOverviewConstraints(raw);

    expect(processed).toBe('Bold and code with link.');
  });

  it('truncates words beyond configured maximum', () => {
    const repeated = Array.from({ length: 90 }, (_, index) => `word${index + 1}`).join(' ');

    const processed = enforceOverviewConstraints(repeated, { maxWords: 80 });

    expect(processed.split(' ').length).toBe(80);
    expect(processed.endsWith('.')).toBe(true);
  });

  it('collapses repeated token loops', () => {
    const raw = 'Decide decide decide quickly quickly quickly.';

    const processed = enforceOverviewConstraints(raw);

    expect(processed).toBe('Decide quickly.');
  });

  it('collapses repeated consecutive sentences', () => {
    const raw =
      'WebGPU accelerates local inference. WebGPU accelerates local inference. It reduces latency.';

    const processed = enforceOverviewConstraints(raw);

    expect(processed).toBe('WebGPU accelerates local inference. It reduces latency.');
  });
});
