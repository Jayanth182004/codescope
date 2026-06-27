# Architecture Decision Records (ADRs)

**ADR 1: Monolithic Frontend File**
- *Decision:* Maintain the entire application within `CodeScopeApp.jsx`.
- *Reasoning:* Simplifies AI context windows and rapid prototyping during the early prompt phases.
- *Status:* Active.

**ADR 2: Bespoke Design System over Tailwind**
- *Decision:* Use a JavaScript `T` token object for all styling.
- *Reasoning:* Ensures absolute consistency and avoids className string soup in the massive monolith file.
- *Status:* Active.

**ADR 3: React Flow for Visualizations**
- *Decision:* Standardize on `@xyflow/react` for all graph, architecture, and dependency visualizations.
- *Reasoning:* Highly performant, extensible, and visually customizable.
- *Status:* Active.
