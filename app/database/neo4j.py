"""
app/database/neo4j.py
─────────────────────
Neo4j driver singleton for CodeScope AI.

Design decisions
────────────────
1. Lazy initialisation: the driver is created on first use so the FastAPI
   startup event does not hard-fail when Neo4j is temporarily unavailable.
   All graph API endpoints catch Neo4j exceptions and return 503.

2. Connection pool: the official neo4j driver manages its own Bolt pool.
   We expose a simple context manager (neo4j_session) so services never
   touch the raw driver directly.

3. Startup indexes: called once from app.main lifespan. Cypher uses
   IF NOT EXISTS so it is safe to call on every restart.

4. Health probe: a cheap "RETURN 1" ping used by GET /graph/health.
"""

import logging
from contextlib import contextmanager

from neo4j import GraphDatabase, Session as Neo4jSession

from app.core.config import settings

logger = logging.getLogger(__name__)

_driver = None


def get_driver():
    """Return the singleton Neo4j driver, creating it on first call."""
    global _driver
    if _driver is None:
        logger.info(
            "Initialising Neo4j driver uri=%s database=%s",
            settings.NEO4J_URI,
            settings.NEO4J_DATABASE,
        )
        _driver = GraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD),
            # Use a modest pool; scale up for production cluster deployments.
            max_connection_pool_size=50,
            connection_timeout=10.0,
        )
    return _driver


def close_driver() -> None:
    """Close the singleton driver — call from FastAPI shutdown lifespan."""
    global _driver
    if _driver is not None:
        _driver.close()
        _driver = None
        logger.info("Neo4j driver closed")


@contextmanager
def neo4j_session() -> Neo4jSession:
    """
    Yield a Neo4j session for the configured database.

    Usage:
        with neo4j_session() as session:
            session.run(...)
    """
    driver = get_driver()
    with driver.session(database=settings.NEO4J_DATABASE) as session:
        yield session


def check_health() -> dict:
    """
    Ping Neo4j and return a dict suitable for the health endpoint.
    Never raises — returns is_healthy=False on failure.
    """
    try:
        with neo4j_session() as session:
            result = session.run("RETURN 1 AS ping")
            result.single()
        return {"is_healthy": True, "uri": settings.NEO4J_URI, "database": settings.NEO4J_DATABASE}
    except Exception as exc:
        logger.warning("Neo4j health check failed: %s", exc)
        return {"is_healthy": False, "uri": settings.NEO4J_URI, "database": settings.NEO4J_DATABASE, "error": str(exc)}


# ── Startup index creation ────────────────────────────────────────────────────

# These Cypher statements are idempotent (IF NOT EXISTS).
# All graph nodes share the :CodeScopeNode label in addition to their specific
# label so we can index shared properties across all node types efficiently.
_STARTUP_INDEXES = [
    # Fast lookup by our internal node ID (maps to dependency_nodes.id)
    "CREATE INDEX cs_node_id IF NOT EXISTS FOR (n:CodeScopeNode) ON (n.node_id)",
    # Filter all nodes belonging to a specific repository
    "CREATE INDEX cs_repository_id IF NOT EXISTS FOR (n:CodeScopeNode) ON (n.repository_id)",
    # Filter nodes by entity_key (e.g. 'file:src/main.py') for upserts
    "CREATE INDEX cs_entity_key IF NOT EXISTS FOR (n:CodeScopeNode) ON (n.entity_key)",
    # analysis_run_id used during incremental sync stale-cleanup sweeps
    "CREATE INDEX cs_analysis_run IF NOT EXISTS FOR (n:CodeScopeNode) ON (n.analysis_run_id)",
    # Full-text search across name and label fields
    (
        "CREATE FULLTEXT INDEX cs_name_fulltext IF NOT EXISTS "
        "FOR (n:CodeScopeNode) ON EACH [n.name, n.label, n.entity_key]"
    ),
]


def ensure_indexes() -> None:
    """
    Create all required Neo4j indexes on startup.
    Called from app.main lifespan. Silently skips if Neo4j is down —
    indexes will be created on the next restart once Neo4j is available.
    """
    try:
        with neo4j_session() as session:
            for cypher in _STARTUP_INDEXES:
                session.run(cypher)
        logger.info("Neo4j startup indexes verified (%d statements)", len(_STARTUP_INDEXES))
    except Exception as exc:
        logger.warning(
            "Neo4j index creation skipped (Neo4j may not be ready yet): %s", exc
        )
