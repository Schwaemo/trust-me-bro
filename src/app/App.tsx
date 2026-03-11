import { useMemo, useState } from 'react';
import { GemmaOverviewCard } from '../components/GemmaOverviewCard';
import { ModelModeToggle } from '../components/ModelModeToggle';
import { ModelStatusBanner } from '../components/ModelStatusBanner';
import { SearchForm } from '../components/SearchForm';
import { getModelCatalogEntry } from '../features/model/modelCatalog';
import { PseResults } from '../features/search/PseResults';
import type { GooglePseEvent } from '../features/search/loadGooglePse';
import { getTestMode } from '../lib/testMode';
import { useSearchController } from '../state/useSearchController';
import styles from './App.module.css';

type AppView = 'home' | 'results';

const homeFooterLinks = ['About', 'Privacy', 'Terms', 'Settings'];

export const App = () => {
  const testMode = getTestMode();
  const [view, setView] = useState<AppView>('home');

  const dependencies = useMemo(() => {
    if (testMode === 'off') {
      return undefined;
    }

    const pseListeners = new Set<(event: GooglePseEvent) => void>();

    return {
      googleCseId: 'mock-cse-id',
      loadPse: async () => Promise.resolve(),
      clearPseResults: () => undefined,
      executePse: (query: string) => {
        const normalizedQuery = query.trim().replace(/\s+/g, ' ');
        window.setTimeout(() => {
          pseListeners.forEach((listener) => {
            listener({
              query: normalizedQuery,
              type: 'ready',
            });
          });
        }, 120);

        return { ok: true as const };
      },
      subscribePseEvents: (listener: (event: GooglePseEvent) => void) => {
        pseListeners.add(listener);
        return () => {
          pseListeners.delete(listener);
        };
      },
    };
  }, [testMode]);

  const controller = useSearchController(dependencies);
  const selectedModelLabel = getModelCatalogEntry(controller.selectedModelMode).displayName;
  const lastGeneratedModelLabel = controller.lastGeneratedModelMode
    ? getModelCatalogEntry(controller.lastGeneratedModelMode).displayName
    : null;
  const modelToggleDisabled =
    controller.modelStatus === 'loading' || controller.generationStatus === 'generating';

  const waitForViewCommit = async () => {
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
  };

  const submitSearch = async () => {
    if (controller.query.trim().length === 0) {
      return;
    }

    setView('results');
    await waitForViewCommit();
    await controller.submit();
  };

  const showHomeView = () => {
    setView('home');
  };

  const sharedSearchProps = {
    disabled: !controller.canSubmit,
    generating: controller.generationStatus === 'generating',
    onQueryChange: controller.setQuery,
    onSubmit: submitSearch,
    query: controller.query,
  };

  return (
    <div className={styles.page}>
      {view === 'home' ? (
        <main className={`${styles.main} ${styles.homeMain} ${styles.viewTransition}`}>
          <section className={styles.homePanel}>
            <h1 className={styles.homeBrand} aria-label="Trust Me Bro">
              <span className={styles.brandBlue}>Trust</span>
              <span className={styles.brandRed}>Me</span>
              <span className={styles.brandYellow}>Bro</span>
            </h1>

            <SearchForm variant="home" {...sharedSearchProps} />

            <div className={styles.homeStatus}>
              <ModelModeToggle
                value={controller.selectedModelMode}
                disabled={modelToggleDisabled}
                onChange={controller.setModelMode}
              />
              <ModelStatusBanner
                status={controller.modelStatus}
                stage={controller.modelStage}
                errorMessage={controller.modelErrorMessage}
                modelDisplayName={selectedModelLabel}
                onRetry={controller.retryModelLoad}
              />
            </div>
          </section>

          <footer className={styles.homeFooter} aria-label="Footer links">
            {homeFooterLinks.map((label) => (
              <button key={label} className={styles.footerLink} type="button">
                {label}
              </button>
            ))}
          </footer>
        </main>
      ) : (
        <main className={`${styles.main} ${styles.resultsMain} ${styles.viewTransition}`}>
          <header className={styles.resultsHeader}>
            <button
              className={styles.logoButton}
              type="button"
              onClick={showHomeView}
              aria-label="Trust Me Bro home"
            >
              <span className={styles.resultsLogo} aria-hidden="true">
                <span className={styles.brandBlue}>Trust</span>
                <span className={styles.brandRed}>Me</span>
                <span className={styles.brandYellow}>Bro</span>
              </span>
            </button>

            <div className={styles.resultsSearch}>
              <SearchForm variant="results" {...sharedSearchProps} />
            </div>
          </header>

          <div className={styles.resultsStatus}>
            <ModelStatusBanner
              status={controller.modelStatus}
              stage={controller.modelStage}
              errorMessage={controller.modelErrorMessage}
              modelDisplayName={selectedModelLabel}
              onRetry={controller.retryModelLoad}
            />
          </div>

          <section className={styles.resultsBody}>
            <GemmaOverviewCard
              query={controller.submittedQuery || controller.query}
              status={controller.generationStatus}
              overviewText={controller.overviewText}
              errorMessage={controller.generationErrorMessage}
              activeModelMode={controller.selectedModelMode}
              activeModelLabel={selectedModelLabel}
              lastGeneratedModelMode={controller.lastGeneratedModelMode}
              lastGeneratedModelLabel={lastGeneratedModelLabel}
              onRetryGeneration={controller.retryGeneration}
            />

            <PseResults
              isConfigured={controller.isCseConfigured}
              isReady={controller.pseReady}
              errorMessage={controller.pseErrorMessage}
              lastQuery={controller.lastPseQuery}
              status={controller.pseStatus}
            />
          </section>
        </main>
      )}
    </div>
  );
};
