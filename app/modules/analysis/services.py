import ast
import hashlib
import json
import logging
import os
import time
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import APIError
from app.modules.analysis.models import (
    AnalysisRun, RepositoryClass, RepositoryFile, RepositoryFolder, RepositoryFunction,
    RepositoryImport, RepositoryLanguage, RepositoryMetrics, RepositoryModule,
)
from app.modules.analysis.repository import AnalysisRepository
from app.modules.repository.repository import new_id
from app.modules.repository.services import RepositoryActivityService, RepositoryValidationService

logger = logging.getLogger("codescope.analysis")
IGNORED_DIRECTORIES = {".git", ".hg", ".svn", "node_modules", ".venv", "venv", "__pycache__", "dist", "build", ".next", ".idea", ".vscode"}


class AnalysisCancelled(Exception):
    pass


@dataclass
class ScannedFile:
    absolute_path: Path
    path: str
    folder_path: str
    name: str
    extension: str
    size: int
    created_at: datetime
    modified_at: datetime
    language: str
    content_hash: str
    encoding: str | None = None
    text: str | None = None
    lines: int = 0
    parse_status: str = "not_applicable"
    parse_error: str | None = None


@dataclass
class FolderRecord:
    path: str; name: str; depth: int; parent_path: str | None
    children_count: int = 0; total_files: int = 0; total_size: int = 0


@dataclass
class ExtractionResult:
    functions: list[dict] = field(default_factory=list)
    classes: list[dict] = field(default_factory=list)
    modules: list[dict] = field(default_factory=list)
    imports: list[dict] = field(default_factory=list)


class LanguageDetectionService:
    EXTENSIONS = {
        ".py": "Python", ".pyi": "Python", ".ts": "TypeScript", ".tsx": "TypeScript",
        ".js": "JavaScript", ".jsx": "JavaScript", ".mjs": "JavaScript", ".cjs": "JavaScript",
        ".json": "JSON", ".yaml": "YAML", ".yml": "YAML", ".md": "Markdown", ".markdown": "Markdown",
    }

    @classmethod
    def detect(cls, path: Path) -> str:
        if path.name.lower() in {"dockerfile", "containerfile"} or path.name.lower().startswith("dockerfile."):
            return "Dockerfile"
        return cls.EXTENSIONS.get(path.suffix.lower(), "Unknown")


class FileScannerService:
    @staticmethod
    def hash_file(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as stream:
            while chunk := stream.read(1024 * 1024): digest.update(chunk)
        return digest.hexdigest()

    @staticmethod
    def decode(path: Path, size: int) -> tuple[str | None, str | None, str | None]:
        if size > settings.MAX_ANALYZED_FILE_SIZE_BYTES:
            return None, None, "File exceeds analysis size limit"
        raw = path.read_bytes()
        for encoding in ("utf-8-sig", "utf-8"):
            try: return raw.decode(encoding), encoding, None
            except UnicodeDecodeError: pass
        return None, None, "Unable to decode file as UTF-8"

    @classmethod
    def scan(cls, root: Path, path: Path) -> ScannedFile:
        stat = path.stat()
        relative = path.relative_to(root).as_posix()
        language = LanguageDetectionService.detect(path)
        item = ScannedFile(
            absolute_path=path, path=relative, folder_path=path.parent.relative_to(root).as_posix() if path.parent != root else "",
            name=path.name, extension=path.suffix.lower(), size=stat.st_size,
            created_at=datetime.fromtimestamp(stat.st_ctime, UTC), modified_at=datetime.fromtimestamp(stat.st_mtime, UTC),
            language=language, content_hash=cls.hash_file(path),
        )
        if language != "Unknown":
            item.text, item.encoding, item.parse_error = cls.decode(path, item.size)
            item.lines = len(item.text.splitlines()) if item.text is not None else 0
            if item.parse_error: item.parse_status = "skipped"
        return item


class RepositoryScannerService:
    @staticmethod
    def validate_root(extracted_path: str | None) -> Path:
        if not extracted_path: raise APIError("Repository has no extracted source", 409)
        root = Path(extracted_path).resolve()
        storage_root = Path(settings.UPLOAD_DIR).resolve()
        if not root.is_dir(): raise APIError("Repository source is unavailable", 409)
        if not root.is_relative_to(storage_root): raise APIError("Repository storage path is outside the configured root", 403)
        return root

    @staticmethod
    def scan(root: Path) -> tuple[list[ScannedFile], list[dict]]:
        files, warnings, stack = [], [], [root]
        while stack:
            directory = stack.pop()
            try:
                entries = list(os.scandir(directory))
            except (OSError, PermissionError) as exc:
                warnings.append({"path": str(directory.relative_to(root)), "code": "directory_unreadable", "message": str(exc)})
                continue
            for entry in entries:
                try:
                    if entry.is_symlink():
                        warnings.append({"path": str(Path(entry.path).relative_to(root)), "code": "symlink_skipped", "message": "Symbolic links are not analyzed"}); continue
                    if entry.is_dir(follow_symlinks=False):
                        if entry.name not in IGNORED_DIRECTORIES: stack.append(Path(entry.path))
                    elif entry.is_file(follow_symlinks=False):
                        if len(files) >= settings.MAX_ANALYSIS_FILES: raise APIError("Repository exceeds the analysis file limit", 413)
                        try: files.append(FileScannerService.scan(root, Path(entry.path)))
                        except (OSError, PermissionError) as exc:
                            warnings.append({"path": str(Path(entry.path).relative_to(root)), "code": "file_unreadable", "message": str(exc)})
                except APIError: raise
                except OSError as exc:
                    warnings.append({"path": entry.name, "code": "scan_error", "message": str(exc)})
        files.sort(key=lambda item: item.path)
        return files, warnings


class FolderScannerService:
    @staticmethod
    def aggregate(files: list[ScannedFile]) -> list[FolderRecord]:
        records = {"": FolderRecord(path="", name="/", depth=0, parent_path=None)}
        direct_children = defaultdict(set)
        for item in files:
            parts = Path(item.folder_path).parts if item.folder_path else ()
            current = ""
            for depth, part in enumerate(parts, 1):
                parent = current
                current = (Path(current) / part).as_posix() if current else part
                records.setdefault(current, FolderRecord(path=current, name=part, depth=depth, parent_path=parent))
                direct_children[parent].add(current)
            for index in range(len(parts) + 1):
                folder = Path(*parts[:index]).as_posix() if index else ""
                records[folder].total_files += 1; records[folder].total_size += item.size
        for path, children in direct_children.items(): records[path].children_count = len(children)
        return sorted(records.values(), key=lambda row: (row.depth, row.path))


class ASTParserService:
    @staticmethod
    def expression(node) -> str | None:
        if node is None: return None
        try: return ast.unparse(node)
        except Exception: return None

    @classmethod
    def parameters(cls, node) -> list[dict]:
        args = node.args
        result = []
        positional = list(args.posonlyargs) + list(args.args)
        defaults = [None] * (len(positional) - len(args.defaults)) + list(args.defaults)
        for arg, default in zip(positional, defaults): result.append({"name": arg.arg, "type": cls.expression(arg.annotation), "default": cls.expression(default), "kind": "positional"})
        if args.vararg: result.append({"name": args.vararg.arg, "type": cls.expression(args.vararg.annotation), "default": None, "kind": "vararg"})
        for arg, default in zip(args.kwonlyargs, args.kw_defaults): result.append({"name": arg.arg, "type": cls.expression(arg.annotation), "default": cls.expression(default), "kind": "keyword_only"})
        if args.kwarg: result.append({"name": args.kwarg.arg, "type": cls.expression(args.kwarg.annotation), "default": None, "kind": "kwarg"})
        return result


class MetadataExtractionService(ast.NodeVisitor):
    def __init__(self, file_path: str, module: str):
        self.file_path, self.module = file_path, module
        self.result = ExtractionResult()
        self.class_stack, self.function_depth = [], 0

    @staticmethod
    def visibility(name): return "private" if name.startswith("__") and not name.endswith("__") else "protected" if name.startswith("_") else "public"

    def visit_ClassDef(self, node):
        qualified = ".".join([self.module, *self.class_stack, node.name])
        self.result.classes.append({"file_path": self.file_path, "module": self.module, "name": node.name, "qualified_name": qualified,
            "line_number": node.lineno, "start_line": node.lineno, "end_line": getattr(node, "end_lineno", node.lineno),
            "visibility": self.visibility(node.name), "bases_json": json.dumps([ASTParserService.expression(base) for base in node.bases]),
            "decorators_json": json.dumps([ASTParserService.expression(item) for item in node.decorator_list]), "docstring": ast.get_docstring(node)})
        self.class_stack.append(node.name); self.generic_visit(node); self.class_stack.pop()

    def _function(self, node, is_async):
        class_name = self.class_stack[-1] if self.class_stack else None
        qualified = ".".join([self.module, *self.class_stack, node.name])
        self.result.functions.append({"file_path": self.file_path, "module": self.module, "class_name": class_name,
            "name": node.name, "qualified_name": qualified, "line_number": node.lineno, "start_line": node.lineno,
            "end_line": getattr(node, "end_lineno", node.lineno), "visibility": self.visibility(node.name), "is_async": is_async,
            "decorators_json": json.dumps([ASTParserService.expression(item) for item in node.decorator_list]),
            "parameters_json": json.dumps(ASTParserService.parameters(node)), "return_type": ASTParserService.expression(node.returns), "docstring": ast.get_docstring(node)})
        self.function_depth += 1; self.generic_visit(node); self.function_depth -= 1

    def visit_FunctionDef(self, node): self._function(node, False)
    def visit_AsyncFunctionDef(self, node): self._function(node, True)

    def visit_Import(self, node):
        for item in node.names: self.result.imports.append({"file_path": self.file_path, "module": item.name, "imported_name": None, "alias": item.asname, "level": 0, "line_number": node.lineno})

    def visit_ImportFrom(self, node):
        for item in node.names: self.result.imports.append({"file_path": self.file_path, "module": node.module or "", "imported_name": item.name, "alias": item.asname, "level": node.level, "line_number": node.lineno})

    @classmethod
    def parse_python(cls, item: ScannedFile) -> ExtractionResult:
        tree = ast.parse(item.text or "", filename=item.path, type_comments=True)
        module = Path(item.path).with_suffix("").as_posix().replace("/", ".")
        if module.endswith(".__init__"): module = module[:-9]
        visitor = cls(item.path, module); visitor.visit(tree)
        package = module.rpartition(".")[0] or None
        visitor.result.modules.append({"file_path": item.path, "name": module, "package": package, "is_package": item.name == "__init__.py", "docstring": ast.get_docstring(tree)})
        return visitor.result


class MetricsCalculationService:
    @staticmethod
    def calculate(files, folders, extraction):
        largest_file = max(files, key=lambda row: row.size, default=None)
        largest_folder = max(folders, key=lambda row: row.total_size, default=None)
        return {"total_files": len(files), "total_folders": max(0, len(folders) - 1), "lines_of_code": sum(row.lines for row in files),
            "languages": len({row.language for row in files if row.language != "Unknown"}), "functions": len(extraction.functions),
            "classes": len(extraction.classes), "modules": len(extraction.modules), "packages": sum(row["is_package"] for row in extraction.modules),
            "imports": len(extraction.imports), "largest_file_path": largest_file.path if largest_file else None,
            "largest_file_size": largest_file.size if largest_file else 0, "largest_folder_path": largest_folder.path if largest_folder else None,
            "largest_folder_size": largest_folder.total_size if largest_folder else 0}


class AnalysisCoordinatorService:
    def __init__(self, db: Session): self.db = db

    def start(self, repository_id: str, user_id: str) -> AnalysisRun:
        repository = RepositoryValidationService.repository_access(self.db, repository_id, user_id, write=True)
        if repository.repo_type != "zip" or repository.status not in {"uploaded"}:
            raise APIError("Only uploaded ZIP repositories can be analyzed", 409)
        if AnalysisRepository.active_run(self.db, repository_id): raise APIError("Analysis is already running", 409)
        root = RepositoryScannerService.validate_root(repository.extracted_path)
        run = AnalysisRun(id=new_id(), repository_id=repository_id, requested_by=user_id, status="running")
        self.db.add(run); RepositoryActivityService.record(self.db, repository, user_id, "Analysis Started", "Static analysis started"); self.db.commit()
        started = time.perf_counter(); warnings = []
        logger.info(json.dumps({"event": "analysis_started", "run_id": run.id, "repository_id": repository_id}))
        try:
            files, scan_warnings = RepositoryScannerService.scan(root); warnings.extend(scan_warnings); run.files_discovered = len(files)
            folders = FolderScannerService.aggregate(files); extracted = ExtractionResult()
            for index, item in enumerate(files):
                if index and index % 250 == 0:
                    self.db.refresh(run, attribute_names=["status"])
                    if run.status == "cancelled": raise AnalysisCancelled()
                if item.language == "Python" and item.text is not None:
                    try:
                        result = MetadataExtractionService.parse_python(item); item.parse_status = "parsed"; run.files_parsed += 1
                        extracted.functions.extend(result.functions); extracted.classes.extend(result.classes); extracted.modules.extend(result.modules); extracted.imports.extend(result.imports)
                    except (SyntaxError, ValueError) as exc:
                        item.parse_status = "failed"; item.parse_error = str(exc); warnings.append({"path": item.path, "code": "parse_error", "message": str(exc)})
                elif item.parse_error:
                    warnings.append({"path": item.path, "code": "file_skipped", "message": item.parse_error})
            common = {"analysis_run_id": run.id, "repository_id": repository_id}
            AnalysisRepository.bulk_add(self.db, [RepositoryFile(id=new_id(), **common, path=row.path, folder_path=row.folder_path, name=row.name, extension=row.extension, size_bytes=row.size, encoding=row.encoding, language=row.language, content_hash=row.content_hash, lines_of_code=row.lines, created_at=row.created_at, modified_at=row.modified_at, parse_status=row.parse_status, parse_error=row.parse_error) for row in files])
            AnalysisRepository.bulk_add(self.db, [RepositoryFolder(id=new_id(), **common, path=row.path, name=row.name, depth=row.depth, parent_path=row.parent_path, children_count=row.children_count, total_files=row.total_files, total_size_bytes=row.total_size) for row in folders])
            for model, rows in ((RepositoryFunction, extracted.functions), (RepositoryClass, extracted.classes), (RepositoryModule, extracted.modules), (RepositoryImport, extracted.imports)):
                AnalysisRepository.bulk_add(self.db, [model(id=new_id(), **common, **row) for row in rows])
            language_stats = defaultdict(lambda: [0, 0, 0])
            for row in files:
                stats = language_stats[row.language]; stats[0] += 1; stats[1] += row.lines; stats[2] += row.size
            total_size = sum(row.size for row in files) or 1
            AnalysisRepository.bulk_add(self.db, [RepositoryLanguage(id=new_id(), **common, language=name, file_count=stats[0], lines_of_code=stats[1], size_bytes=stats[2], percentage=round(stats[2] * 100 / total_size, 2)) for name, stats in language_stats.items()])
            self.db.add(RepositoryMetrics(id=new_id(), **common, **MetricsCalculationService.calculate(files, folders, extracted)))
            run.errors_count = len(warnings); run.warnings_json = json.dumps(warnings[:1000]); run.status = "completed_with_warnings" if warnings else "completed"
            run.completed_at = datetime.now(UTC); run.duration_ms = int((time.perf_counter() - started) * 1000)
            RepositoryActivityService.record(self.db, repository, user_id, "Analysis Completed", f"Static analysis completed: {len(files)} files, {run.errors_count} warnings")
            if repository.metadata_record:
                repository.metadata_record.total_files = len(files); repository.metadata_record.total_folders = max(0, len(folders) - 1)
            language_counts = Counter(row.language for row in files if row.language != "Unknown")
            repository.language = language_counts.most_common(1)[0][0] if language_counts else None
            self.db.commit(); self.db.refresh(run)
            logger.info(json.dumps({"event": "analysis_completed", "run_id": run.id, "files": len(files), "warnings": len(warnings), "duration_ms": run.duration_ms}))
            return run
        except AnalysisCancelled:
            self.db.rollback(); run = self.db.get(AnalysisRun, run.id); run.status = "cancelled"
            run.completed_at = datetime.now(UTC); run.duration_ms = int((time.perf_counter() - started) * 1000)
            RepositoryActivityService.record(self.db, repository, user_id, "Analysis Cancelled", "Static analysis cancelled")
            self.db.commit(); return run
        except Exception as exc:
            self.db.rollback(); run = self.db.get(AnalysisRun, run.id)
            run.status = "failed"; run.error_message = str(exc); run.completed_at = datetime.now(UTC); run.duration_ms = int((time.perf_counter() - started) * 1000)
            RepositoryActivityService.record(self.db, repository, user_id, "Analysis Failed", str(exc)); self.db.commit()
            logger.exception(json.dumps({"event": "analysis_failed", "run_id": run.id, "error": str(exc)}))
            if isinstance(exc, APIError): raise
            raise APIError("Analysis failed", 500, [{"message": str(exc)}]) from exc
