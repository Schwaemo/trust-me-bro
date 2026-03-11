import styles from './PseResults.module.css';
import { PSE_RESULTS_CONTAINER_ID } from './loadGooglePse';
import type { PseStatus } from '../../state/types';

interface PseResultsProps {
  errorMessage: string | null;
  isConfigured: boolean;
  isReady: boolean;
  lastQuery: string;
  status: PseStatus;
}

export const PseResults = ({
  errorMessage,
  isConfigured,
  isReady,
  lastQuery,
  status,
}: PseResultsProps) => {
  return (
    <section className={styles.card} aria-live="polite">
      <header className={styles.header}>
        <h2>Web Results</h2>
        {!isConfigured && (
          <p className={styles.notice}>
            Set VITE_GOOGLE_CSE_ID to enable Google Programmable Search.
          </p>
        )}
        {isConfigured && !isReady && !errorMessage && (
          <p className={styles.notice}>Loading results module...</p>
        )}
        {errorMessage && <p className={styles.error}>{errorMessage}</p>}
        {status === 'success' && lastQuery && !errorMessage && (
          <p className={styles.notice}>Showing results for “{lastQuery}”.</p>
        )}
      </header>
      <div className={`${styles.resultsViewport} ${status === 'loading' ? styles.loadingViewport : ''}`}>
        {status === 'loading' && (
          <div className={styles.skeleton} data-testid="pse-loading-skeleton" aria-hidden="true">
            <span className={styles.skeletonLine} />
            <span className={styles.skeletonLine} />
            <span className={styles.skeletonLine} />
          </div>
        )}
        <div id={PSE_RESULTS_CONTAINER_ID} data-testid="pse-results" />
      </div>
    </section>
  );
};
