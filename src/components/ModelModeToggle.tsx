import { getModelCatalogEntry } from '../features/model/modelCatalog';
import type { ModelMode } from '../state/types';
import styles from './ModelModeToggle.module.css';

interface ModelModeToggleProps {
  disabled: boolean;
  onChange: (nextMode: ModelMode) => void;
  value: ModelMode;
}

const basicLabel = getModelCatalogEntry('basic').displayName;
const advancedLabel = getModelCatalogEntry('advanced').displayName;

export const ModelModeToggle = ({ disabled, onChange, value }: ModelModeToggleProps) => {
  const isAdvanced = value === 'advanced';

  return (
    <section className={styles.container} aria-live="polite">
      <p className={styles.heading}>Model mode</p>
      <div className={styles.controlRow}>
        <span className={`${styles.modeLabel} ${!isAdvanced ? styles.modeLabelActive : ''}`}>
          {basicLabel}
        </span>

        <button
          type="button"
          role="switch"
          data-testid="model-mode-toggle"
          aria-label="Toggle model mode"
          aria-checked={isAdvanced}
          className={styles.switchButton}
          disabled={disabled}
          onClick={() => {
            onChange(isAdvanced ? 'basic' : 'advanced');
          }}
        >
          <span className={styles.switchThumb} aria-hidden="true" />
        </button>

        <span
          className={`${styles.modeLabel} ${styles.modeLabelRight} ${isAdvanced ? styles.modeLabelActive : ''}`}
        >
          {advancedLabel}
        </span>
      </div>
    </section>
  );
};
