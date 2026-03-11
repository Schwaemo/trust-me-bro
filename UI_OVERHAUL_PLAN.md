# UI Overhaul Plan: Google Search Clone

This plan outlines the steps to transform the current "Standalone Search Demo" into a high-fidelity Google Search clone interface, featuring a dedicated "AI Overview" section powered by the local Gemma model.

## Phase 1: Design System & Assets
- [ ] **Typography**: Import simple, clean sans-serif fonts (Arial, Roboto) to mimic Google's typography.
- [ ] **Color Palette**: Define Google brand colors in `tokens.css`:
    - Google Blue (`#4285f4`)
    - Google Red (`#ea4335`)
    - Google Yellow (`#fbbc05`)
    - Google Green (`#34a853`)
    - Background Greys (`#f1f3f4` for hovers, `#202124` for dark mode text)
- [ ] **Logo**: Create a "Trust Me Bro" logo using Google's multi-color style (or a placeholder Google-like logo).
- [ ] **Icons**: Integrate Material Symbols or similar for search, microphone, and settings icons.

## Phase 2: Layout Restructuring (Home vs. Results)
- [ ] **State Management**: Modify `App.tsx` to handle distinct "Home" and "Results" views based on whether a query has been submitted.
- [ ] **Home View Component**:
    - Centered "Trust Me Bro" logo.
    - Large, rounded search bar with shadow on hover.
    - "Google Search" and "I'm Feeling Lucky" style buttons.
    - Footer with simplified links (About, Settings, etc. - non-functional or placeholders).
- [ ] **Results View Layout**:
    - Sticky Top Search Header: Small logo on left, search bar in middle, profile/settings on right.
    - Navigation Tabs: (All, Images, News - visual only).
    - Main Content Area: centered with max-width (approx 652px for results).

## Phase 3: AI Overview Component ("Gemma Overview")
- [ ] **Container Styling**:
    - Distinct container at the top of results.
    - specialized background (subtle gradient or pastel color) to distinguish from standard results.
    - "Generative AI is experimental" disclaimer pill.
- [ ] **Content Styling**:
    - Typing effect or streaming simulation for the answer.
    - Accordion or "Show more" functionality if content is long.
    - Action buttons (Copy, Regenerate) styled elegantly at the bottom.

## Phase 4: Search Results Styling (PSE)
- [ ] **Custom CSS for PSE**:
    - Override default Google Programmable Search Engine styles.
    - Remove default Google branding where possible/allowed.
    - Style links to match Google's standard:
        - Title: 20px, Blue (`#1a0dab`), hover underline.
        - URL: 14px, Green/Black (`#202124`).
        - Snippet: 14px, Grey (`#4d5156`).
- [ ] **Performance**: Ensure no layout shift when PSE loads.

## Phase 5: Implementation Steps
1.  **Update `tokens.css`**: Add Google color variables.
2.  **Refactor `App.tsx`**: separate `HomeView` and `ResultsView`.
3.  **Build `HomeView`**: Implement the centered search experience.
4.  **Build `ResultsView`**: Implement the top bar and results container.
5.  **Style `GemmaOverviewCard`**: Apply the "AI Snapshot" aesthetic.
6.  **Style `PseResults`**: Apply custom CSS to the programmable search element.

## Phase 6: Polish
- [ ] **Animations**: Smooth transition from Home input to Top bar input.
- [ ] **Responsiveness**: Ensure mobile layout works (hamburger menu, stacked results).
- [ ] **Dark Mode**: (Optional) Toggle for dark theme.
