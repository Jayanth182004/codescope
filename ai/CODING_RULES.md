# Coding Rules

1. **Single File Constraint:** Unless explicitly authorized, all components MUST be written inside `CodeScopeApp.jsx`.
2. **Styling Constraint:** Use the `T` design token object for inline styles. No Tailwind.
3. **Accessibility:** Ensure buttons have `aria-label`s, use semantic tags like `<button>` instead of `<div>` for clickable elements.
4. **Mock Data:** Any new views must include highly detailed `mockData` objects to simulate a real backend response, ensuring the UI is visually demonstrable.
