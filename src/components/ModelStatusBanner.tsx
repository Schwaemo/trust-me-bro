import type { ModelStatus } from '../state/types';
import styles from './ModelStatusBanner.module.css';

interface ModelStatusBannerProps {
  errorMessage: string | null;
  modelDisplayName: string;
  onRetry: () => Promise<void>;
  stage: string;
  status: ModelStatus;
}

export const ModelStatusBanner = ({
  errorMessage,
  modelDisplayName,
  onRetry,
  stage,
  status,
}: ModelStatusBannerProps) => {
  if (status === 'ready') {
    return (
      <section className={`${styles.banner} ${styles.ready}`} aria-live="polite">
        <div className={styles.messageGroup}>
          <strong>Model ready.</strong>
          <span>{modelDisplayName} is loaded locally in your browser.</span>
        </div>
      </section>
    );
  }

  if (status === 'error') {
    return (
      <section className={`${styles.banner} ${styles.error}`} role="alert" aria-live="assertive">
        <div className={styles.messageGroup}>
          <strong>Model failed to load.</strong>
          <span>{errorMessage ?? `Could not load ${modelDisplayName}. Please try again.`}</span>
        </div>
        <button type="button" onClick={() => void onRetry()} className={styles.retryButton}>
          Retry loading model
        </button>
      </section>
    );
  }

  return (
    <section className={`${styles.banner} ${styles.pending}`} aria-live="polite">
      <div className={styles.messageGroup}>
        <strong>Loading model...</strong>
        <span>{stage}</span>
      </div>
    </section>
  );
};
