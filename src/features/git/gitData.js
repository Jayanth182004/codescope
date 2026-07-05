const gitMockData = {
  repositories: ["main-api", "frontend-platform", "payments-service", "auth-gateway"],
  branches: ["main", "release/2.4", "feature/auth-hardening", "hotfix/token-refresh"],
  stats: {
    totalCommits: 1248,
    contributors: 18,
    averageCommitsPerDay: 7.4,
    largestCommit: "9f42a1c",
    mostActiveBranch: "main",
    mostModifiedFile: "src/auth/token.service.ts",
    oldestFile: "src/main.ts",
    newestFile: "src/features/impact/impactData.js"
  },
  commits: [
    {
      hash: "9f42a1c",
      message: "Harden token refresh rotation and session invalidation",
      author: "Arjun Mehta",
      avatar: "AM",
      date: "2026-06-28 10:42",
      branch: "main",
      type: "Security",
      filesChanged: 12,
      insertions: 382,
      deletions: 91,
      parent: "7d11bc4",
      tags: ["auth", "security", "release-blocker"],
      changedFiles: ["src/auth/token.service.ts", "src/auth/auth.guard.ts", "src/auth/refresh-token.repository.ts", "tests/auth.integration.spec.ts"],
      changedFunctions: ["issueAccessToken", "rotateRefreshToken", "revokeSession"],
      changedClasses: ["TokenService", "RefreshTokenRepository"],
      relatedIssue: "AUTH-482 placeholder",
      relatedPR: "PR #318 placeholder",
      summary: "Introduced stricter refresh-token rotation and expanded regression coverage."
    },
    {
      hash: "7d11bc4",
      message: "Split user profile reads from authentication guard",
      author: "Mira Chen",
      avatar: "MC",
      date: "2026-06-27 16:18",
      branch: "feature/auth-hardening",
      type: "Refactor",
      filesChanged: 8,
      insertions: 214,
      deletions: 176,
      parent: "6ba0921",
      tags: ["users", "auth", "refactor"],
      changedFiles: ["src/users/user.service.ts", "src/users/user.routes.ts", "src/auth/auth.guard.ts"],
      changedFunctions: ["getCurrentUser", "requireAuthenticatedUser"],
      changedClasses: ["UserService", "AuthGuard"],
      relatedIssue: "USER-211 placeholder",
      relatedPR: "PR #314 placeholder",
      summary: "Reduced coupling between user profile loading and route authentication."
    },
    {
      hash: "6ba0921",
      message: "Add gateway contract tests for authenticated requests",
      author: "Jon Rivera",
      avatar: "JR",
      date: "2026-06-26 11:05",
      branch: "main",
      type: "Test",
      filesChanged: 5,
      insertions: 166,
      deletions: 12,
      parent: "3dc81ef",
      tags: ["gateway", "contracts"],
      changedFiles: ["services/api-gateway/auth_contract_test.go", "openapi/auth.yaml"],
      changedFunctions: ["ValidateAuthHeader", "ForwardIdentityClaims"],
      changedClasses: [],
      relatedIssue: "GATE-88 placeholder",
      relatedPR: "PR #309 placeholder",
      summary: "Protected gateway auth behavior with contract tests."
    },
    {
      hash: "3dc81ef",
      message: "Rename session cache adapter and isolate Redis usage",
      author: "Arjun Mehta",
      avatar: "AM",
      date: "2026-06-25 09:30",
      branch: "main",
      type: "Refactor",
      filesChanged: 9,
      insertions: 248,
      deletions: 202,
      parent: "2a90dd0",
      tags: ["redis", "sessions"],
      changedFiles: ["src/auth/session-cache.ts", "src/cache/redis-client.ts", "src/auth/token.service.ts"],
      changedFunctions: ["readSession", "writeSession", "clearSession"],
      changedClasses: ["SessionCacheAdapter"],
      relatedIssue: "CACHE-144 placeholder",
      relatedPR: "PR #301 placeholder",
      summary: "Made Redis an adapter dependency instead of direct token-service coupling."
    },
    {
      hash: "2a90dd0",
      message: "Introduce repository analysis summary cards",
      author: "Priya Nair",
      avatar: "PN",
      date: "2026-06-23 14:12",
      branch: "main",
      type: "Feature",
      filesChanged: 14,
      insertions: 521,
      deletions: 73,
      parent: "f18ab02",
      tags: ["analysis", "dashboard"],
      changedFiles: ["CodeScopeApp.jsx", "src/app/appConfig.jsx", "src/ui/dashboardPrimitives.jsx"],
      changedFunctions: ["RepoAnalysisPage", "MetricCard"],
      changedClasses: [],
      relatedIssue: "UI-102 placeholder",
      relatedPR: "PR #290 placeholder",
      summary: "Added repository health and analysis metrics to the product flow."
    },
    {
      hash: "f18ab02",
      message: "Create initial repository upload workflow",
      author: "Mira Chen",
      avatar: "MC",
      date: "2026-06-20 17:41",
      branch: "main",
      type: "Feature",
      filesChanged: 11,
      insertions: 612,
      deletions: 41,
      parent: "a44c701",
      tags: ["repositories", "upload"],
      changedFiles: ["app/modules/repository/router.py", "app/modules/repository/schemas.py", "CodeScopeApp.jsx"],
      changedFunctions: ["handleZipUpload", "handleGitConnect"],
      changedClasses: ["Repository"],
      relatedIssue: "REPO-64 placeholder",
      relatedPR: "PR #276 placeholder",
      summary: "Established repository creation and connection entry points."
    }
  ],
  fileEvolution: [
    { file: "src/auth/token.service.ts", state: "Created", commit: "a44c701", date: "2026-05-14", detail: "Initial JWT issuing service added." },
    { file: "src/auth/token.service.ts", state: "Modified", commit: "3dc81ef", date: "2026-06-25", detail: "Session cache moved behind adapter." },
    { file: "src/auth/token.service.ts", state: "Refactored", commit: "7d11bc4", date: "2026-06-27", detail: "Auth guard stopped loading user profile directly." },
    { file: "src/auth/token.service.ts", state: "Hardened", commit: "9f42a1c", date: "2026-06-28", detail: "Refresh-token rotation and invalidation rules tightened." }
  ],
  functionEvolution: [
    { fn: "issueAccessToken", state: "Created", commit: "a44c701", date: "2026-05-14", detail: "Created as JWT helper." },
    { fn: "issueAccessToken", state: "Modified", commit: "3dc81ef", date: "2026-06-25", detail: "Added session cache linkage." },
    { fn: "issueAccessToken", state: "Optimized", commit: "9f42a1c", date: "2026-06-28", detail: "Reduced token claim construction duplication." },
    { fn: "rotateRefreshToken", state: "Created", commit: "9f42a1c", date: "2026-06-28", detail: "Introduced one-time refresh token rotation." }
  ],
  authors: [
    { name: "Arjun Mehta", initials: "AM", commits: 418, filesModified: 231, activeAreas: ["auth", "repositories", "analysis"], timeline: [8, 12, 18, 22, 31, 29, 34] },
    { name: "Mira Chen", initials: "MC", commits: 296, filesModified: 174, activeAreas: ["users", "frontend", "repository"], timeline: [5, 9, 11, 18, 20, 17, 23] },
    { name: "Priya Nair", initials: "PN", commits: 214, filesModified: 148, activeAreas: ["dashboard", "ux", "analysis"], timeline: [3, 7, 14, 13, 19, 21, 18] },
    { name: "Jon Rivera", initials: "JR", commits: 176, filesModified: 119, activeAreas: ["gateway", "tests", "contracts"], timeline: [2, 6, 9, 12, 16, 15, 17] }
  ],
  hotspots: {
    mostChangedFiles: [
      { name: "src/auth/token.service.ts", changes: 42, risk: "High" },
      { name: "CodeScopeApp.jsx", changes: 39, risk: "High" },
      { name: "app/modules/repository/router.py", changes: 28, risk: "Medium" }
    ],
    leastChangedFiles: [
      { name: "app/core/exceptions.py", changes: 3, risk: "Low" },
      { name: "Dockerfile", changes: 2, risk: "Low" },
      { name: "README.md", changes: 2, risk: "Low" }
    ],
    recentlyActiveModules: ["auth", "repository", "impact", "dashboard"],
    stableAreas: ["core exceptions", "database session", "container config"]
  },
  relatedChanges: [
    { title: "Auth Token Flow", type: "Files", items: ["token.service.ts", "auth.guard.ts", "refresh-token.repository.ts"], confidence: 92 },
    { title: "Repository Upload Flow", type: "Functions", items: ["handleZipUpload", "handleGitConnect", "createRepository"], confidence: 88 },
    { title: "Gateway Auth Contract", type: "Services", items: ["auth-api", "api-gateway", "mobile-client"], confidence: 84 }
  ],
  replay: [
    { index: 0, hash: "a44c701", label: "Repository upload baseline", files: 76, functions: 420, modules: 18 },
    { index: 1, hash: "f18ab02", label: "Repository management arrives", files: 91, functions: 518, modules: 22 },
    { index: 2, hash: "2a90dd0", label: "Analysis surfaces expand", files: 108, functions: 632, modules: 28 },
    { index: 3, hash: "3dc81ef", label: "Auth cache refactor", files: 116, functions: 650, modules: 30 },
    { index: 4, hash: "9f42a1c", label: "Security hardening", files: 124, functions: 691, modules: 34 }
  ],
  future: [
    "AI Commit Summary",
    "Bug Introduction Prediction",
    "Automatic Release Notes",
    "Pull Request Analysis"
  ]
};

export { gitMockData };
