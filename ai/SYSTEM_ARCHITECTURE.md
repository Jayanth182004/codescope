# System Architecture

**Current State:** Monolithic Frontend (React).
**Constraint:** The entire application UI, state management, and design system are currently contained within a single massive file: `CodeScopeApp.jsx`.

- **Framework:** React + Vite
- **Styling:** Custom inline Design Token system (`T` object). NO external CSS frameworks (No Tailwind).
- **Graphing:** `@xyflow/react` is used for node/edge visualization.
- **Routing:** Handled via a manual `screen` state machine and `activePage` string in the App Shell.
