const SENTENCE_SEPARATOR = /(?<=[.!?])\s+/;

const normalizeText = (raw: string): string => {
  return raw
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const truncateWords = (input: string, maxWords: number): string => {
  const words = input.split(' ').filter(Boolean);
  if (words.length <= maxWords) {
    return input;
  }
  return words.slice(0, maxWords).join(' ').trim();
};

const ensureTerminalPunctuation = (input: string): string => {
  if (!input) {
    return input;
  }
  return /[.!?]$/.test(input) ? input : `${input}.`;
};

const sentenceKey = (sentence: string): string =>
  sentence
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const tokenKey = (token: string): string =>
  token
    .toLowerCase()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
    .trim();

const collapseRepeatedSentences = (input: string): string => {
  const sentences = input
    .split(SENTENCE_SEPARATOR)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (sentences.length <= 1) {
    return input;
  }

  const deduped: string[] = [];
  let previousKey = '';

  sentences.forEach((sentence) => {
    const key = sentenceKey(sentence);
    if (key && key === previousKey) {
      return;
    }

    deduped.push(sentence);
    previousKey = key;
  });

  return deduped.join(' ').trim();
};

const collapseRepeatedTokens = (input: string): string => {
  const tokens = input.split(' ').filter(Boolean);
  if (tokens.length <= 1) {
    return input;
  }

  const deduped: string[] = [];
  let previousKey = '';

  tokens.forEach((token) => {
    const key = tokenKey(token);
    if (key && key === previousKey) {
      return;
    }

    deduped.push(token);
    previousKey = key;
  });

  return deduped.join(' ').trim();
};

export const enforceOverviewConstraints = (
  raw: string,
  options: { maxSentences?: number; maxWords?: number } = {},
): string => {
  const maxSentences = options.maxSentences ?? 3;
  const maxWords = options.maxWords ?? 80;
  const cleaned = normalizeText(raw);
  const deduped = collapseRepeatedSentences(collapseRepeatedTokens(cleaned));

  if (!deduped) {
    return '';
  }

  const sentenceCandidates = deduped
    .split(SENTENCE_SEPARATOR)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const selectedSentences =
    sentenceCandidates.length > 0
      ? sentenceCandidates.slice(0, Math.max(1, maxSentences))
      : [deduped];

  const sentenceBoundText = selectedSentences.join(' ').trim();
  const wordBoundText = truncateWords(sentenceBoundText, Math.max(1, maxWords));
  return ensureTerminalPunctuation(wordBoundText);
};
