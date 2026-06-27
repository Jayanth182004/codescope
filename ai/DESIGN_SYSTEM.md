# Design System

We strictly use a bespoke JavaScript design token object called `T` defined in `CodeScopeApp.jsx`.

**Tokens Include:**
- `T.bg`, `T.surface`, `T.surfaceHov`, `T.surfaceEl` (Backgrounds)
- `T.text`, `T.dim`, `T.faint` (Typography colors)
- `T.accent`, `T.accentBright`, `T.accentSoft` (Primary colors)
- `T.success`, `T.warning`, `T.error`, `T.info` (Semantic colors)
- `T.border`, `T.borderMid`, `T.shadow` (Borders and elevation)
- `T.mono`, `T.sans` (Fonts)
- `T.r4`, `T.r6`, `T.r8` (Border radii)

**Rule:** Do NOT use Tailwind classes. Do NOT write standard CSS classes unless modifying `GLOBAL_CSS`. Always use inline styles referencing `T`.
