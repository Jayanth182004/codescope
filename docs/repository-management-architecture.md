# Repository Management Architecture

## Purpose and API Flow

Every endpoint authenticates a JWT, resolves project/workspace membership, validates its request, invokes a service workflow, commits one database transaction, and returns the shared API envelope. Members may read; owners and admins may create, update, upload, connect, favorite, archive, change settings, and delete.

`RepositoryRepo` contains query and persistence operations. `RepositoryService` owns lifecycle transactions. `UploadService` streams and safely extracts archives. `GitConnectionService` validates registration targets without cloning. Dedicated validation, activity, metadata, search, and settings services keep HTTP and database concerns separate.

## Upload Lifecycle

1. Validate project access, unique name, filename, and archive limits.
2. Stream the upload to an opaque local path while computing SHA-256.
3. Inspect every ZIP entry and reject corruption, traversal, symbolic links, excessive entries, or excessive expanded size.
4. Extract into a repository-scoped UUID directory.
5. Persist repository, settings, normalized tags, upload audit, generated file/folder/size metadata, project count, and activity in one transaction.
6. Remove archive and extracted content if persistence fails.

No source parsing or analysis occurs in Phase 2.

## Database Relationships

- A project and workspace each own many repositories; deleting either cascades repositories.
- A user may own many repositories; deleting the user retains repository records with a null owner.
- Repository metadata and settings are one-to-one children.
- Tags, activity entries, upload records, and favorites are one-to-many children.
- Favorites form a unique user/repository association.
- Project/name and repository/tag uniqueness prevent duplicate records.

Indexes cover project/status lists, workspace/update ordering, activity chronology, upload chronology, tags, and ownership lookups.

## Future Analysis Integration

Phase 3 should treat `extracted_path`, `status`, and `repository_metadata` as its input contract. It should create separate analysis-owned tables and statuses rather than adding parser output to upload records. Git cloning remains a separate future workflow with isolated credentials and execution limits.
