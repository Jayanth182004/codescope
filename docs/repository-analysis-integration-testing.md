# Repository Analysis Frontend Integration Testing

This checklist verifies Integration Phase 1: Repository Analysis.

## Architecture

- Frontend server state is loaded through TanStack Query.
- Axios sends requests to `VITE_API_BASE_URL` or `http://127.0.0.1:8000/api/v1`.
- Bearer tokens are read from `codescope_access_token` or `access_token` in `localStorage`.
- Zustand stores only global UI selection: selected repository id and name.
- Backend analysis data remains the source of truth.

## Request Lifecycle

1. User selects a repository.
2. Repository Overview calls `POST /api/v1/analysis/start/{repository_id}`.
3. The Analysis page polls `/api/v1/analysis/status?repository_id=...`.
4. Once complete, TanStack Query fetches report, metrics, and the active lazy entity tab.
5. Entity tables fetch only when selected: functions, classes, modules, or imports.

## Manual Flow

1. Start backend on `http://127.0.0.1:8000`.
2. Start frontend on `http://127.0.0.1:5173`.
3. Register or sign in through the UI, or store a valid token manually:

```js
localStorage.setItem("codescope_access_token", "<token>")
```

4. Upload a ZIP repository through the backend or UI once upload is connected.
5. Select the uploaded repository and open Repository Overview.
6. Click **Analyze Repository**.
7. Confirm the Repository Analysis page shows loading/progress.
8. Confirm metrics populate from backend data.
9. Switch tabs between Functions, Classes, Modules, and Imports.
10. Confirm each tab fetches only when opened.

## Edge Cases

- Missing token: page shows a sign-in friendly error.
- Permission denied: page shows a permission message and retry/run buttons.
- Repository not found: page explains that analysis data is unavailable.
- Unsupported repository: page asks for an uploaded ZIP repository.
- Network error: page suggests confirming the backend is running.
- Completed with warnings: metrics render and warnings are displayed.
- No analysis data: page offers **Run Analysis**.

## Automated Coverage

- Backend integration tests cover start, report, status, metrics, entity endpoints, warnings, and permissions.
- Path-style endpoint aliases are covered for:
  - `/analysis/status/{repository_id}`
  - `/analysis/metrics/{repository_id}`
  - `/analysis/files/{repository_id}`
  - `/analysis/functions/{repository_id}`
  - `/analysis/classes/{repository_id}`
  - `/analysis/modules/{repository_id}`
  - `/analysis/imports/{repository_id}`
- Frontend build verifies TanStack Query, Axios, and Zustand integration compiles.
