# Repository Management Manual Testing

1. Start PostgreSQL and the API with `docker compose up --build db backend`.
2. Register and authenticate; copy the access token into Swagger at `/docs`.
3. Create a workspace and project, then create a repository with `POST /api/v1/repositories`.
4. Confirm a duplicate name in the same project returns `409`.
5. Upload a valid ZIP and verify metadata, extracted files, activity, upload history, and project count.
6. Upload a renamed non-ZIP, corrupt ZIP, path-traversal ZIP, oversized ZIP, and empty ZIP; confirm no files remain on disk.
7. Connect an HTTPS Git URL and verify no clone occurs and no embedded credentials are accepted.
8. Exercise search, status/visibility/type/tag/favorite filters, sorting, and pagination.
9. Update metadata/settings, favorite, archive/restore, and delete; verify audit events and storage cleanup.
10. Repeat read/write calls as a workspace member and outsider; members may read, while only owners/admins may mutate.

Phase 3 will consume `extracted_path` and `repository_metadata`. This phase intentionally performs no parsing, indexing, cloning, or analysis.
