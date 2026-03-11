import styles from './SearchForm.module.css';

type SearchFormVariant = 'home' | 'results';

interface SearchFormProps {
  disabled: boolean;
  generating: boolean;
  onQueryChange: (nextQuery: string) => void;
  onSubmit: () => Promise<void>;
  query: string;
  variant: SearchFormVariant;
}

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M15.7 14.3h-.8l-.3-.3a6.2 6.2 0 1 0-.7.7l.3.3v.8L19 20.5 20.5 19l-4.8-4.7Zm-5.5 0a4.1 4.1 0 1 1 0-8.2 4.1 4.1 0 0 1 0 8.2Z"
      fill="currentColor"
    />
  </svg>
);

const MicIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 15.1a3.1 3.1 0 0 0 3.1-3.1V7A3.1 3.1 0 0 0 12 3.9 3.1 3.1 0 0 0 8.9 7v5a3.1 3.1 0 0 0 3.1 3.1Zm5.2-3.3a.8.8 0 1 0-1.6 0 3.6 3.6 0 1 1-7.2 0 .8.8 0 0 0-1.6 0 5.2 5.2 0 0 0 4.4 5.1V20H9.5a.8.8 0 1 0 0 1.6h5a.8.8 0 1 0 0-1.6h-1.7V17a5.2 5.2 0 0 0 4.4-5.2Z"
      fill="currentColor"
    />
  </svg>
);

const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M19.1 13.4c.1-.5.2-1 .2-1.4 0-.5-.1-.9-.2-1.4l1.8-1.4a.7.7 0 0 0 .2-.9l-1.7-3a.7.7 0 0 0-.8-.3l-2.1.8a6.8 6.8 0 0 0-2.4-1.4l-.3-2.2a.7.7 0 0 0-.7-.6h-3.4a.7.7 0 0 0-.7.6L8.7 4.4c-.9.3-1.7.8-2.4 1.4l-2.1-.8a.7.7 0 0 0-.8.3l-1.7 3a.7.7 0 0 0 .2.9l1.8 1.4c-.1.5-.2 1-.2 1.4 0 .5.1.9.2 1.4L2 14.8a.7.7 0 0 0-.2.9l1.7 3c.2.3.5.4.8.3l2.1-.8c.7.6 1.5 1.1 2.4 1.4l.3 2.2c.1.3.4.6.7.6h3.4c.3 0 .6-.3.7-.6l.3-2.2c.9-.3 1.7-.8 2.4-1.4l2.1.8c.3.1.6 0 .8-.3l1.7-3a.7.7 0 0 0-.2-.9l-1.8-1.4ZM12 15.4a3.4 3.4 0 1 1 0-6.8 3.4 3.4 0 0 1 0 6.8Z"
      fill="currentColor"
    />
  </svg>
);

export const SearchForm = ({
  disabled,
  generating,
  onQueryChange,
  onSubmit,
  query,
  variant,
}: SearchFormProps) => {
  const submitDisabled = disabled || query.trim().length === 0;

  return (
    <form
      className={`${styles.form} ${variant === 'home' ? styles.homeForm : styles.resultsForm}`}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <label className={styles.visuallyHidden} htmlFor={`search-query-${variant}`}>
        Search query
      </label>
      <div className={styles.searchShell}>
        <span className={styles.leadingIcon}>
          <SearchIcon />
        </span>

        <input
          id={`search-query-${variant}`}
          className={styles.input}
          type="text"
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value);
          }}
          placeholder={
            variant === 'home'
              ? 'Search the web with a local AI overview'
              : 'Search the web'
          }
          autoComplete="off"
        />

        {variant === 'home' ? (
          <div className={styles.trailingDecor} aria-hidden="true">
            <span className={styles.decorIcon}>
              <MicIcon />
            </span>
            <span className={styles.decorIcon}>
              <SettingsIcon />
            </span>
          </div>
        ) : (
          <div className={styles.resultsActions}>
            <span className={styles.decorIcon} aria-hidden="true">
              <SettingsIcon />
            </span>
            <span className={styles.decorIcon} aria-hidden="true">
              <MicIcon />
            </span>
            <button type="submit" className={styles.iconSubmit} disabled={submitDisabled}>
              <span className={styles.visuallyHidden}>Search</span>
              <SearchIcon />
            </button>
          </div>
        )}
      </div>

      {variant === 'home' && (
        <div className={styles.buttonRow}>
          <button type="submit" className={styles.homeSubmit} disabled={submitDisabled}>
            {generating ? 'Generating...' : 'Google Search'}
          </button>
        </div>
      )}
    </form>
  );
};
