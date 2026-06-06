const impactTargets = [
  {
    id: "repo-core",
    name: "main-api",
    type: "Repository",
    children: [
      {
        id: "folder-auth",
        name: "src/auth",
        type: "Folder",
        children: [
          {
            id: "file-token",
            name: "token.service.ts",
            type: "File",
            children: [
              {
                id: "class-token-service",
                name: "TokenService",
                type: "Class",
                children: [
                  { id: "fn-issue-token", name: "issueAccessToken", type: "Function", children: [] },
                  { id: "fn-verify-token", name: "verifyAccessToken", type: "Function", children: [] }
                ]
              }
            ]
          },
          {
            id: "file-auth-guard",
            name: "auth.guard.ts",
            type: "File",
            children: [
              { id: "fn-require-auth", name: "requireAuthenticatedUser", type: "Function", children: [] }
            ]
          }
        ]
      },
      {
        id: "folder-users",
        name: "src/users",
        type: "Folder",
        children: [
          {
            id: "file-user-service",
            name: "user.service.ts",
            type: "File",
            children: [
              { id: "class-user-service", name: "UserService", type: "Class", children: [] }
            ]
          },
          { id: "api-users-me", name: "GET /users/me", type: "API Endpoint", children: [] }
        ]
      },
      { id: "service-auth-api", name: "auth-api", type: "Service", children: [] }
    ]
  }
];

const impactHistory = [
  { id: "hist-1", target: "TokenService", risk: "High", when: "12 minutes ago", summary: "Auth token change affected 8 API routes." },
  { id: "hist-2", target: "UserRepository", risk: "Medium", when: "Yesterday", summary: "Repository signature change required service tests." },
  { id: "hist-3", target: "FeatureFlags", risk: "Low", when: "3 days ago", summary: "Config rename affected two modules." }
];

const impactMockData = {
  selectedTargetId: "class-token-service",
  selectedTargetName: "TokenService",
  selectedTargetPath: "src/auth/token.service.ts",
  summary: {
    riskScore: 82,
    filesAffected: 18,
    functionsAffected: 47,
    classesAffected: 9,
    servicesAffected: 4,
    apisAffected: 8,
    databaseTablesAffected: 2,
    estimatedTestCoverage: 74,
    confidenceScore: 91
  },
  risk: {
    level: "High",
    reasons: [
      "Used by 18 files across authentication, users, billing, and gateway modules.",
      "Called directly by 8 externally exposed API endpoints.",
      "Controls session issuance and authorization boundaries.",
      "Touches database-backed refresh token state and Redis session cache."
    ]
  },
  criticalPath: ["class-token-service", "fn-issue-token", "api-login", "service-api-gateway", "service-mobile-client"],
  nodes: [
    { id: "class-token-service", type: "impact", position: { x: 420, y: 40 }, data: { label: "TokenService", type: "Class", path: "src/auth/token.service.ts", language: "TypeScript", risk: "High", impact: "Selected target", dependencyCount: 26, action: "Review public method contracts before editing.", reason: "Central token orchestration class.", depth: 0, category: "Classes", tests: ["token.service.spec.ts", "auth.integration.spec.ts"] } },
    { id: "fn-issue-token", type: "impact", position: { x: 180, y: 180 }, data: { label: "issueAccessToken", type: "Function", path: "src/auth/token.service.ts:42", language: "TypeScript", risk: "High", impact: "Direct impact", dependencyCount: 14, action: "Run auth and session unit tests.", reason: "Called by login, refresh, and service account flows.", depth: 1, category: "Functions", tests: ["issue-token.spec.ts"] } },
    { id: "fn-verify-token", type: "impact", position: { x: 520, y: 180 }, data: { label: "verifyAccessToken", type: "Function", path: "src/auth/token.service.ts:88", language: "TypeScript", risk: "Critical", impact: "Direct impact", dependencyCount: 22, action: "Run full API regression.", reason: "Guards all authenticated routes.", depth: 1, category: "Functions", tests: ["auth-guard.spec.ts", "api-auth.regression.ts"] } },
    { id: "file-auth-guard", type: "impact", position: { x: 800, y: 180 }, data: { label: "auth.guard.ts", type: "File", path: "src/auth/auth.guard.ts", language: "TypeScript", risk: "High", impact: "Direct impact", dependencyCount: 17, action: "Verify middleware behavior.", reason: "Consumes token verification result.", depth: 1, category: "Files", tests: ["auth.guard.spec.ts"] } },
    { id: "api-login", type: "impact", position: { x: 80, y: 330 }, data: { label: "POST /auth/login", type: "API Endpoint", path: "src/routes/auth.routes.ts", language: "HTTP", risk: "High", impact: "Indirect impact", dependencyCount: 9, action: "Run login smoke and integration tests.", reason: "Issues tokens through selected target.", depth: 2, category: "APIs", tests: ["login.e2e.ts"] } },
    { id: "api-refresh", type: "impact", position: { x: 310, y: 330 }, data: { label: "POST /auth/refresh", type: "API Endpoint", path: "src/routes/auth.routes.ts", language: "HTTP", risk: "High", impact: "Indirect impact", dependencyCount: 8, action: "Validate refresh-token rotation.", reason: "Shares issuance and persistence logic.", depth: 2, category: "APIs", tests: ["refresh-token.e2e.ts"] } },
    { id: "api-users-me", type: "impact", position: { x: 540, y: 330 }, data: { label: "GET /users/me", type: "API Endpoint", path: "src/users/user.routes.ts", language: "HTTP", risk: "Medium", impact: "Indirect impact", dependencyCount: 5, action: "Run authenticated user route tests.", reason: "Requires verified identity from auth guard.", depth: 2, category: "APIs", tests: ["users-me.integration.ts"] } },
    { id: "service-api-gateway", type: "impact", position: { x: 770, y: 330 }, data: { label: "api-gateway", type: "Service", path: "services/api-gateway", language: "Go", risk: "High", impact: "Indirect impact", dependencyCount: 12, action: "Coordinate gateway contract verification.", reason: "Forwards auth headers and expects token claims.", depth: 2, category: "Services", tests: ["gateway-contract.test.go"] } },
    { id: "repo-refresh-token", type: "impact", position: { x: 190, y: 500 }, data: { label: "RefreshTokenRepository", type: "Repository", path: "src/auth/refresh-token.repository.ts", language: "TypeScript", risk: "Medium", impact: "Indirect impact", dependencyCount: 6, action: "Check persistence schema assumptions.", reason: "Stores and revokes refresh token records.", depth: 3, category: "Repositories", tests: ["refresh-token.repository.spec.ts"] } },
    { id: "db-refresh-tokens", type: "impact", position: { x: 420, y: 500 }, data: { label: "refresh_tokens", type: "Database Table", path: "db.tables.refresh_tokens", language: "SQL", risk: "Medium", impact: "Indirect impact", dependencyCount: 4, action: "Review migration compatibility.", reason: "Token lifecycle state is persisted here.", depth: 3, category: "Databases", tests: ["auth-migrations.sql.test"] } },
    { id: "worker-session-cleanup", type: "impact", position: { x: 650, y: 500 }, data: { label: "session-cleanup-worker", type: "Worker", path: "workers/session-cleanup", language: "TypeScript", risk: "Medium", impact: "Indirect impact", dependencyCount: 3, action: "Run scheduled worker smoke tests.", reason: "Expires token and session records.", depth: 3, category: "Workers", tests: ["session-cleanup.worker.spec.ts"] } },
    { id: "service-mobile-client", type: "impact", position: { x: 880, y: 500 }, data: { label: "mobile-client", type: "Service", path: "clients/mobile", language: "Kotlin", risk: "High", impact: "Critical path", dependencyCount: 7, action: "Notify mobile team before token contract changes.", reason: "Consumes token claim shape and refresh behavior.", depth: 3, category: "Services", tests: ["mobile-auth-contract.test"] } }
  ],
  edges: [
    { id: "i1", source: "class-token-service", target: "fn-issue-token", label: "defines", depth: 1, critical: true, direct: true },
    { id: "i2", source: "class-token-service", target: "fn-verify-token", label: "defines", depth: 1, critical: false, direct: true },
    { id: "i3", source: "fn-verify-token", target: "file-auth-guard", label: "called by", depth: 1, critical: false, direct: true },
    { id: "i4", source: "fn-issue-token", target: "api-login", label: "called by", depth: 2, critical: true, direct: false },
    { id: "i5", source: "fn-issue-token", target: "api-refresh", label: "called by", depth: 2, critical: false, direct: false },
    { id: "i6", source: "file-auth-guard", target: "api-users-me", label: "guards", depth: 2, critical: false, direct: false },
    { id: "i7", source: "file-auth-guard", target: "service-api-gateway", label: "depends on", depth: 2, critical: true, direct: false },
    { id: "i8", source: "api-refresh", target: "repo-refresh-token", label: "uses", depth: 3, critical: false, direct: false },
    { id: "i9", source: "repo-refresh-token", target: "db-refresh-tokens", label: "queries", depth: 3, critical: false, direct: false },
    { id: "i10", source: "db-refresh-tokens", target: "worker-session-cleanup", label: "referenced by", depth: 3, critical: false, direct: false },
    { id: "i11", source: "service-api-gateway", target: "service-mobile-client", label: "contract", depth: 3, critical: true, direct: false }
  ],
  affectedComponents: [
    { category: "Files", count: 18, items: ["src/auth/token.service.ts", "src/auth/auth.guard.ts", "src/routes/auth.routes.ts", "src/users/user.routes.ts"] },
    { category: "Functions", count: 47, items: ["issueAccessToken", "verifyAccessToken", "requireAuthenticatedUser", "refreshSession"] },
    { category: "Classes", count: 9, items: ["TokenService", "AuthController", "UserService", "RefreshTokenRepository"] },
    { category: "Services", count: 4, items: ["auth-api", "api-gateway", "mobile-client", "billing-service"] },
    { category: "Controllers", count: 3, items: ["AuthController", "UserController", "BillingController"] },
    { category: "Repositories", count: 2, items: ["RefreshTokenRepository", "UserRepository"] },
    { category: "APIs", count: 8, items: ["POST /auth/login", "POST /auth/refresh", "GET /users/me", "POST /billing/checkout"] },
    { category: "Databases", count: 2, items: ["refresh_tokens", "users"] },
    { category: "Workers", count: 1, items: ["session-cleanup-worker"] }
  ],
  recommendations: [
    { title: "Safe to Rename", level: "Medium", detail: "Only rename internal private helpers after dependency search shows no exported references." },
    { title: "Requires Full Regression", level: "High", detail: "Run auth, user, gateway, and billing regressions because token behavior crosses service boundaries." },
    { title: "Update Documentation", level: "Medium", detail: "Document any token claim, expiration, or refresh semantics changes for API consumers." },
    { title: "Notify Team", level: "High", detail: "Coordinate with API Gateway and mobile teams before changing token contract shape." },
    { title: "Review Database Changes", level: "Medium", detail: "Validate migrations and retention jobs if refresh token persistence changes." },
    { title: "Review API Contracts", level: "High", detail: "Check OpenAPI auth responses and gateway contract tests before release." }
  ],
  suggestedTests: [
    { category: "Unit Tests", why: "Protect token generation, verification, and edge-case validation.", tests: ["token.service.spec.ts", "auth.guard.spec.ts", "refresh-token.repository.spec.ts"] },
    { category: "Integration Tests", why: "Verify API routes still authenticate and propagate user identity.", tests: ["auth.integration.spec.ts", "users-me.integration.ts", "billing-auth.integration.ts"] },
    { category: "Regression Tests", why: "Catch cross-module behavior drift in login, refresh, and authorization flows.", tests: ["api-auth.regression.ts", "session-regression.ts"] },
    { category: "Manual Verification", why: "Confirm browser and mobile sessions behave as expected after the change.", tests: ["Login with existing user", "Refresh expired token", "Logout from all devices"] },
    { category: "Smoke Tests", why: "Quickly validate production-critical auth surfaces after deployment.", tests: ["POST /auth/login", "GET /users/me", "Gateway health with auth header"] }
  ],
  timeline: [
    { title: "Previous Similar Changes", status: "Available after Git Intelligence", detail: "Will compare past token-service edits with incident and test outcomes." },
    { title: "Recent Modifications", status: "Available after Git Intelligence", detail: "Will show commits touching this file, class, and downstream API routes." },
    { title: "Historical Risk", status: "Available after Git Intelligence", detail: "Will estimate risk using change frequency, rollback history, and ownership." }
  ],
  report: {
    selectedComponent: "TokenService",
    riskScore: 82,
    summary: "Changing TokenService is high risk because it controls authentication tokens used by APIs, services, workers, and clients.",
    exportStatus: "PDF export placeholder"
  }
};

export { impactMockData, impactTargets, impactHistory };
