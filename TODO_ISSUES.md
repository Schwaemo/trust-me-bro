# Issue Report & TODOs: Search Robustness and Quality

Based on automated testing of the search interface, the following issues were identified, particularly under "heavy usage" and rapid query conditions.

## 1. Interaction & State Management (Critical)
- [x] **Fix Race Conditions in Search**: 
    - **Issue**: Rapidly typing and submitting queries (e.g., "react" -> "vue") can result in the UI showing "Showing results for 'vue'" while the links below are still for "react".
    - **Fix**: Ensure the search results list is cleared immediately upon a new submission and only repopulated when the *correct* results return. Use a request ID or timestamp to discard stale responses.
- [x] **Implement Generation Cancellation**:
    - **Issue**: The Gemma overview generation continues even if the user has navigated away or submitted a new query. This wastes resources and can overwrite the *new* query's overview with old text.
    - **Fix**: Use an `AbortController` or similar mechanism to cancel the current LLM generation task when a new search is initiated.
- [x] **Fix Google PSE Search Results Disappearing**:
    - **Issue**: Second and subsequent searches fail to load Google results (UI shows skeleton or blank space).
    - **Cause**: `clearGooglePseResults` manually wipes the DOM container (`innerHTML = ''`). However, the Google PSE library retains the "element" in memory. On the next search, `ensureSearchResultsElement` retrieves the in-memory element (which thinks it's alive) instead of re-rendering it into the DOM. The execution succeeds internally but renders nowhere.
    - **Fix**: In `ensureSearchResultsElement`, check if the DOM node actually exists (e.g., check if the container is empty). If the DOM is missing, force a re-render (`elementApi.render`) even if `getElement` returns an object.

## 2. AI Overview Quality (High Priority)
- [x] **Improve Prompt/Sampling for Repetitiveness**:
    - **Issue**: The Gemma model (270M) frequently enters repetitive loops (e.g., "decide, decide, decide...").
    - **Fix**: 
        - Adjust sampling parameters (temperature, top_k, top_p, repetition_penalty).
        - Refine the system prompt to be more strict about conciseness and avoiding loops.
- [x] **Handle "Stuck" Generating State**:
    - **Issue**: Occasional reports of the overview card getting stuck in "Generating..." state if a new search interrupts the previous one.
    - **Fix**: Ensure the state machine resets correctly on every new search submission, explicitly clearing any "loading" flags.

## 3. UI/UX Polish
- [x] **Layout Stability**:
    - **Issue**: Minor layout shifts were observed when results load in.
    - **Fix**: Reserve fixed height or use skeleton loaders for the results container to minimize shift.
- [x] **Console Cleanup**:
    - **Issue**: `SecurityError` and cross-origin warnings from the Google PSE script populate the console.
    - **Fix**: Added safe-only cleanup by handling controllable execution/setup failures without global error suppression. Known cross-origin warnings from Google-controlled internals may still appear.

## Execution Plan for Agent
1.  **Tackle Section 1** first to ensure data integrity and UI correctness.
2.  **Address Section 2** to make the feature actually usable (repetitive text breaks the feature's value).
3.  **Polish Section 3** as time permits.
