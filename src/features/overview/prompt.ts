export const OVERVIEW_INSTRUCTION = 'Agree and explain why in 1-2 sentences.';

export const buildPrompt = (query: string): string => {
  const sanitizedQuery = query.trim().replace(/\s+/g, ' ');
  return `${OVERVIEW_INSTRUCTION}\n\nStatement: ${sanitizedQuery}\n\nAnswer:`;
};
