# Repository Analysis Manual Testing

Use this checklist after starting the backend and frontend locally.

## Prerequisites

1. Register or sign in.
2. Create a workspace and project.
3. Upload a valid ZIP repository through the repository API or UI.
4. Confirm the repository response contains `status: uploaded`.

## Start Analysis

```bash
curl -X POST http://127.0.0.1:8000/api/v1/analysis/start/<repository_id> \
  -H "Authorization: Bearer <token>"
```

Expected result:

- `success: true`
- `data.status` is `completed` or `completed_with_warnings`
- `files_discovered` is greater than zero
- `duration_ms` is populated

## Read Analysis Report

```bash
curl "http://127.0.0.1:8000/api/v1/analysis/<repository_id>" \
  -H "Authorization: Bearer <token>"
```

Check:

- metrics totals match the uploaded repository roughly
- languages include detected file types
- warnings explain parse, decode, or size-limit issues

## Inspect Entities

```bash
curl "http://127.0.0.1:8000/api/v1/analysis/files?repository_id=<repository_id>&search=src" \
  -H "Authorization: Bearer <token>"

curl "http://127.0.0.1:8000/api/v1/analysis/functions?repository_id=<repository_id>" \
  -H "Authorization: Bearer <token>"

curl "http://127.0.0.1:8000/api/v1/analysis/classes?repository_id=<repository_id>" \
  -H "Authorization: Bearer <token>"

curl "http://127.0.0.1:8000/api/v1/analysis/modules?repository_id=<repository_id>" \
  -H "Authorization: Bearer <token>"

curl "http://127.0.0.1:8000/api/v1/analysis/imports?repository_id=<repository_id>" \
  -H "Authorization: Bearer <token>"
```

Check:

- Python files have `parse_status: parsed`
- syntax errors have `parse_status: failed`
- oversized Python files have `parse_status: skipped`
- functions include `qualified_name`, `parameters`, `return_type`, `is_async`, and method `class_name`
- classes include `bases`, `decorators`, and `docstring`
- imports include module, imported name, alias, level, and line number

## Permission Checks

Use a token for a user who is not a workspace member.

Expected:

- starting analysis returns `403`
- reading report/entity endpoints returns `403`

## Unsupported Repositories

Try a Git-registered repository that has not been uploaded and extracted.

Expected:

- starting analysis returns a validation error because Phase 3 only analyzes uploaded ZIP repositories.
