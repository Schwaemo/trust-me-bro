import { useEffect, useRef, useState } from 'react';
import type { GenerationStatus, ModelMode } from '../state/types';
import styles from './GemmaOverviewCard.module.css';

interface GemmaOverviewCardProps {
  activeModelLabel: string;
  activeModelMode: ModelMode;
  errorMessage: string | null;
  lastGeneratedModelLabel: string | null;
  lastGeneratedModelMode: ModelMode | null;
  onRetryGeneration: () => Promise<void>;
  overviewText: string;
  query: string;
  status: GenerationStatus;
}

export const GemmaOverviewCard = ({
  activeModelLabel,
  activeModelMode,
  errorMessage,
  lastGeneratedModelLabel,
  lastGeneratedModelMode,
  onRetryGeneration,
  overviewText,
  query,
  status,
}: GemmaOverviewCardProps) => {
  const hasQuery = query.trim().length > 0;
  const outputRef = useRef<HTMLParagraphElement | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const attributionModelLabel = lastGeneratedModelLabel ?? activeModelLabel;
  const showRegenerationHint =
    status === 'success' &&
    lastGeneratedModelMode !== null &&
    lastGeneratedModelMode !== activeModelMode;

  useEffect(() => {
    setIsExpanded(false);
  }, [overviewText]);

  useEffect(() => {
    if (status !== 'success') {
      setCanExpand(false);
      return;
    }

    if (isExpanded) {
      return;
    }

    const measureOverflow = () => {
      const element = outputRef.current;
      if (!element) {
        return;
      }

      setCanExpand(element.scrollHeight > element.clientHeight + 1);
    };

    measureOverflow();

    const element = outputRef.current;
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && element
        ? new ResizeObserver(() => {
            measureOverflow();
          })
        : null;

    if (resizeObserver && element) {
      resizeObserver.observe(element);
    }

    window.addEventListener('resize', measureOverflow);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', measureOverflow);
    };
  }, [isExpanded, overviewText, status]);

  return (
    <section className={styles.card} aria-live="polite">
      <header className={styles.header}>
        <div className={styles.headingRow}>
          <h2>AI Overview</h2>
          <span className={styles.experimentPill}>Generative AI is experimental</span>
        </div>
        <p className={styles.disclaimer}>
          Generated locally by {attributionModelLabel} from the query only; may be incorrect.
        </p>
        {showRegenerationHint && (
          <p className={styles.modeHint}>
            Current mode is {activeModelLabel}. Submit again to regenerate with this model.
          </p>
        )}
      </header>

      <div className={styles.body}>
        {status === 'idle' && !hasQuery && (
          <p className={styles.placeholder}>Enter a query and submit once the model is ready.</p>
        )}

        {status === 'idle' && hasQuery && (
          <p className={styles.placeholder}>Ready to generate an overview for “{query.trim()}”.</p>
        )}

        {status === 'generating' && (
          <p className={styles.loading}>
            {hasQuery ? `Generating overview for “${query.trim()}”…` : 'Generating...'}
          </p>
        )}

        {status === 'success' && (
          <>
            <p
              ref={outputRef}
              className={`${styles.output} ${!isExpanded ? styles.outputClamped : ''}`}
            >
              {overviewText}
            </p>

            {canExpand && (
              <button
                type="button"
                className={styles.expandButton}
                onClick={() => {
                  setIsExpanded((prev) => !prev);
                }}
              >
                {isExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </>
        )}

        {status === 'error' && (
          <div className={styles.errorBlock} role="alert">
            <p>{errorMessage ?? 'Could not generate overview.'}</p>
          </div>
        )}
      </div>

      <footer className={styles.actions}>
        <button
          type="button"
          className={styles.regenerateButton}
          disabled={!hasQuery || status === 'generating'}
          onClick={() => void onRetryGeneration()}
        >
          {status === 'generating' ? 'Generating...' : status === 'error' ? 'Try again' : 'Regenerate'}
        </button>
      </footer>
    </section>
  );
};
