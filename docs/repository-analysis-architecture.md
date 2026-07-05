# Repository Analysis Engine

Backend Phase 3 adds a bounded static-analysis pipeline for repositories uploaded through the Phase 2 ZIP engine.

## Purpose

The engine converts extracted repository files into normalized metadata that later features can query without rereading source code:

- Repository files and folders
- Language distribution
- Python modules, classes, functions, methods, decorators, parameters, imports, docstrings, and inheritance
- Repository metrics
- Analysis run lifecycle and warnings

This phase does not clone Git repositories, run AI inference, build Neo4j graphs, predict architecture, or compute change impact.

## Pipeline

1. Authorize repository access.
2. Validate that the repository is an uploaded ZIP with a trusted `extracted_path`.
3. Scan folders and files while skipping ignored directories and symlinks.
4. Detect languages from filenames and extensions.
5. Decode text files safely and count lines.
6. Parse Python files with the standard `ast` module.
7. Persist analysis run rows, folder rows, file rows, language rows, modules, functions, classes, imports, and metrics.
8. Mark the run as `completed`, `completed_with_warnings`, `failed`, or `cancelled`.
9. Record repository activity.

## Safety Limits

The scanner is intentionally bounded:

- `MAX_ANALYSIS_FILES`
- `MAX_ANALYZED_FILE_SIZE_BYTES`
- `UPLOAD_DIR` root containment
- ignored heavy directories such as `.git`, `node_modules`, `.venv`, `dist`, `build`, and cache folders
- symlink exclusion
- parse/decode errors are reported as warnings instead of crashing successful scans

## Data Model

- `analysis_runs` stores one snapshot per analysis execution.
- `repository_folders` stores folder aggregation.
- `repository_files` stores detected file metadata and parse status.
- `repository_languages` stores language counts, LOC, bytes, and percentages.
- `repository_modules` stores Python module/package metadata.
- `repository_functions` stores Python functions and methods.
- `repository_classes` stores Python classes and inheritance/decorator metadata.
- `repository_imports` stores Python import statements.
- `repository_metrics` stores rollups used by overview and analysis screens.

Rows are keyed by `analysis_run_id` so later graph and impact features can compare snapshots instead of mutating current-state records.

## API Surface

- `POST /api/v1/analysis/start/{repository_id}`
- `POST /api/v1/analysis/cancel/{repository_id}`
- `GET /api/v1/analysis/status?repository_id=...`
- `GET /api/v1/analysis/{repository_id}`
- `GET /api/v1/analysis/files?repository_id=...`
- `GET /api/v1/analysis/functions?repository_id=...`
- `GET /api/v1/analysis/classes?repository_id=...`
- `GET /api/v1/analysis/modules?repository_id=...`
- `GET /api/v1/analysis/imports?repository_id=...`
- `GET /api/v1/analysis/metrics?repository_id=...`

Entity list endpoints support `search`, `limit`, and `offset`.

## Extension Path

The next backend phase should consume these tables to generate graph-ready dependency APIs. Rich TypeScript/JavaScript parsing, queued workers, Git cloning, Neo4j synchronization, and AI-assisted interpretation should remain separate decisions.
