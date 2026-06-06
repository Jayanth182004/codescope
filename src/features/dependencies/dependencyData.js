const dependencyMockData = {
  nodes: [
    { id: "API Gateway", type: "customDep", position: { x: 400, y: 50 }, data: { label: "API Gateway", type: "Service", lang: "Go", risk: "Low", fanIn: 1, fanOut: 2, files: 1, functions: 4, classes: 0, modules: 1, apis: 3, services: 1, loc: "gateway/main.go", updated: "2 hrs ago" } },
    { id: "UserController", type: "customDep", position: { x: 300, y: 150 }, data: { label: "UserController", type: "Class", lang: "TypeScript", risk: "Medium", fanIn: 2, fanOut: 1, files: 3, functions: 12, classes: 2, modules: 1, apis: 5, services: 0, loc: "src/controllers/UserController.ts", updated: "1 day ago" } },
    { id: "UserService", type: "customDep", position: { x: 400, y: 250 }, data: { label: "UserService", type: "Class", lang: "TypeScript", risk: "High", fanIn: 3, fanOut: 3, files: 14, functions: 38, classes: 4, modules: 2, apis: 1, services: 1, loc: "src/services/UserService.ts", updated: "3 days ago" } },
    { id: "AuthMiddleware", type: "customDep", position: { x: 100, y: 150 }, data: { label: "AuthMiddleware", type: "Function", lang: "TypeScript", risk: "Medium", fanIn: 1, fanOut: 1, files: 4, functions: 6, classes: 0, modules: 1, apis: 2, services: 0, loc: "src/middleware/auth.ts", updated: "1 week ago" } },
    { id: "UserRepository", type: "customDep", position: { x: 400, y: 350 }, data: { label: "UserRepository", type: "Class", lang: "TypeScript", risk: "Medium", fanIn: 2, fanOut: 1, files: 2, functions: 15, classes: 1, modules: 1, apis: 0, services: 0, loc: "src/repos/UserRepository.ts", updated: "2 days ago" } },
    { id: "Database", type: "customDep", position: { x: 400, y: 450 }, data: { label: "UsersTable", type: "Database Table", lang: "SQL", risk: "Critical", fanIn: 4, fanOut: 0, files: 28, functions: 112, classes: 14, modules: 4, apis: 8, services: 2, loc: "db:users", updated: "1 month ago" } },
    { id: "RedisCache", type: "customDep", position: { x: 600, y: 350 }, data: { label: "SessionCache", type: "Database Table", lang: "Redis", risk: "Low", fanIn: 2, fanOut: 0, files: 4, functions: 10, classes: 2, modules: 1, apis: 0, services: 0, loc: "cache:sessions", updated: "3 mos ago" } },
    { id: "Logger", type: "customDep", position: { x: 100, y: 350 }, data: { label: "Logger", type: "Module", lang: "TypeScript", risk: "Low", fanIn: 8, fanOut: 0, files: 120, functions: 450, classes: 32, modules: 15, apis: 0, services: 0, loc: "src/utils/logger.ts", updated: "1 year ago" } },
    { id: "PaymentService", type: "customDep", position: { x: 700, y: 250 }, data: { label: "PaymentService", type: "Service", lang: "Java", risk: "Critical", fanIn: 1, fanOut: 1, files: 45, functions: 180, classes: 30, modules: 8, apis: 12, services: 3, loc: "billing/PaymentService.java", updated: "4 hrs ago" } },
    { id: "AppConfig", type: "customDep", position: { x: 100, y: 50 }, data: { label: "config.json", type: "Configuration File", lang: "JSON", risk: "Critical", fanIn: 12, fanOut: 0, files: 140, functions: 0, classes: 0, modules: 20, apis: 0, services: 5, loc: "config/default.json", updated: "5 days ago" } },
    { id: "ENV_URL", type: "customDep", position: { x: -100, y: 50 }, data: { label: "DATABASE_URL", type: "Environment Variable", lang: "ENV", risk: "Critical", fanIn: 5, fanOut: 0, files: 12, functions: 0, classes: 0, modules: 4, apis: 0, services: 2, loc: ".env", updated: "6 mos ago" } },
    { id: "BaseModel", type: "customDep", position: { x: 800, y: 350 }, data: { label: "BaseModel", type: "Class", lang: "TypeScript", risk: "High", fanIn: 10, fanOut: 0, files: 40, functions: 80, classes: 20, modules: 2, apis: 0, services: 0, loc: "src/models/BaseModel.ts", updated: "1 year ago" } },
    { id: "RepoCore", type: "customDep", position: { x: 600, y: -50 }, data: { label: "CoreBackend", type: "Repository", lang: "Mixed", risk: "Critical", fanIn: 1, fanOut: 1, files: 2500, functions: 10000, classes: 800, modules: 50, apis: 100, services: 10, loc: "github.com/org/core", updated: "1 hr ago" } },
    { id: "SrcFolder", type: "customDep", position: { x: 600, y: 50 }, data: { label: "src/services", type: "Folder", lang: "TypeScript", risk: "Medium", fanIn: 2, fanOut: 1, files: 20, functions: 100, classes: 10, modules: 1, apis: 0, services: 0, loc: "src/services/", updated: "1 day ago" } },
    { id: "HelperFile", type: "customDep", position: { x: 100, y: 250 }, data: { label: "helpers.ts", type: "File", lang: "TypeScript", risk: "Low", fanIn: 5, fanOut: 1, files: 1, functions: 15, classes: 0, modules: 0, apis: 0, services: 0, loc: "src/utils/helpers.ts", updated: "1 week ago" } },
    { id: "NPMReact", type: "customDep", position: { x: 800, y: 150 }, data: { label: "npm: react", type: "Package", lang: "JavaScript", risk: "High", fanIn: 20, fanOut: 0, files: 100, functions: 500, classes: 50, modules: 10, apis: 0, services: 0, loc: "node_modules/react", updated: "6 mos ago" } },
    { id: "EndpointAPI", type: "customDep", position: { x: 600, y: 150 }, data: { label: "POST /users", type: "API Endpoint", lang: "HTTP", risk: "High", fanIn: 3, fanOut: 1, files: 1, functions: 1, classes: 1, modules: 1, apis: 1, services: 1, loc: "src/routes/users.ts", updated: "2 days ago" } },
  ],
  edges: [
    { id: "d1", source: "API Gateway", target: "UserController", label: "routes to" },
    { id: "d2", source: "API Gateway", target: "AuthMiddleware", label: "uses" },
    { id: "d3", source: "AuthMiddleware", target: "UserService", label: "calls" },
    { id: "d4", source: "UserController", target: "UserService", label: "calls" },
    { id: "d5", source: "UserService", target: "UserRepository", label: "depends on" },
    { id: "d6", source: "UserService", target: "Logger", label: "imports" },
    { id: "d7", source: "UserRepository", target: "Database", label: "queries" },
    { id: "d8", source: "UserService", target: "RedisCache", label: "uses" },
    { id: "d9", source: "PaymentService", target: "UserService", label: "calls" },
    { id: "d10", source: "AppConfig", target: "API Gateway", label: "read by" },
    { id: "d11", source: "ENV_URL", target: "Database", label: "configures" },
    { id: "d12", source: "UserController", target: "AppConfig", label: "read by" },
    { id: "d13", source: "UserRepository", target: "BaseModel", label: "extends" },
    { id: "d14", source: "PaymentService", target: "Logger", label: "references" },
    { id: "d15", source: "RepoCore", target: "SrcFolder", label: "contains" },
    { id: "d16", source: "SrcFolder", target: "UserService", label: "contains" },
    { id: "d17", source: "UserService", target: "HelperFile", label: "imports" },
    { id: "d18", source: "HelperFile", target: "Logger", label: "imports" },
    { id: "d19", source: "PaymentService", target: "EndpointAPI", label: "calls" },
    { id: "d20", source: "EndpointAPI", target: "UserController", label: "routes to" },
    { id: "d21", source: "EndpointAPI", target: "NPMReact", label: "uses" },
  ]
};

const dependencyTree = [
  { id: "RepoCore", name: "CoreBackend", type: "Repository", children: [
    { id: "SrcFolder", name: "src/services", type: "Folder", children: [
      { id: "UserService", name: "UserService", type: "Class", children: [
        { id: "UserRepository", name: "UserRepository", type: "Class", children: [
          { id: "Database", name: "UsersTable", type: "Database Table", children: [] },
          { id: "BaseModel", name: "BaseModel", type: "Class", children: [] }
        ]},
        { id: "RedisCache", name: "SessionCache", type: "Database Table", children: [] },
        { id: "Logger", name: "Logger", type: "Module", children: [] },
        { id: "HelperFile", name: "helpers.ts", type: "File", children: [] }
      ]}
    ]}
  ]},
  { id: "AppConfig", name: "config.json", type: "Configuration File", children: [] },
  { id: "ENV_URL", name: "DATABASE_URL", type: "Environment Variable", children: [] },
  { id: "API Gateway", name: "API Gateway", type: "Service", children: [
    { id: "UserController", name: "UserController", type: "Class", children: [] },
    { id: "AuthMiddleware", name: "AuthMiddleware", type: "Function", children: [] }
  ]},
  { id: "PaymentService", name: "PaymentService", type: "Service", children: [
    { id: "EndpointAPI", name: "POST /users", type: "API Endpoint", children: [
      { id: "NPMReact", name: "npm: react", type: "Package", children: [] }
    ]}
  ]}
];


export { dependencyMockData, dependencyTree };

