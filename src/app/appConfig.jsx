import { Icons, T } from "../ui/foundation.jsx";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", Icon: Icons.dashboard, group: "main" },
  { id: "projects", label: "Projects", Icon: Icons.projects, group: "main" },
  { id: "repos", label: "Repositories", Icon: Icons.repos, group: "main" },
  null,
  { id: "arch", label: "Architecture", Icon: Icons.arch, group: "explore" },
  { id: "deps", label: "Dependencies", Icon: Icons.deps, group: "explore" },
  { id: "git", label: "Git Intelligence", Icon: Icons.git, group: "explore" },
  { id: "impact", label: "Impact Analysis", Icon: Icons.impact, group: "explore" },
  { id: "errors", label: "Error Investigation", Icon: Icons.error, group: "explore" },
  null,
  { id: "ai", label: "AI Assistant", Icon: Icons.ai, group: "tools" },
  { id: "settings", label: "Settings", Icon: Icons.settings, group: "tools" },
];

const PAGE_META = {
  dashboard: { label: "Dashboard", breadcrumb: ["Dashboard"] },
  projects: { label: "Projects", breadcrumb: ["Dashboard", "Projects"] },
  repos: { label: "Repositories", breadcrumb: ["Dashboard", "Repositories"] },
  arch: { label: "Architecture", breadcrumb: ["Dashboard", "Architecture Explorer"] },
  deps: { label: "Dependencies", breadcrumb: ["Dashboard", "Dependency Explorer"] },
  git: { label: "Git Intelligence", breadcrumb: ["Dashboard", "Git Intelligence"] },
  impact: { label: "Impact Analysis", breadcrumb: ["Dashboard", "Impact Analysis"] },
  errors: { label: "Error Investigation", breadcrumb: ["Dashboard", "Error Investigation"] },
  ai: { label: "AI Assistant", breadcrumb: ["Dashboard", "AI Assistant"] },
  settings: { label: "Settings", breadcrumb: ["Dashboard", "Settings"] },
  "repo-overview": { label: "Repository Overview", breadcrumb: ["Dashboard", "Repositories", "frontend-platform"] },
  "repo-explorer": { label: "Repository Explorer", breadcrumb: ["Dashboard", "Repositories", "frontend-platform", "Explorer"] },
  "repo-analysis": { label: "Repository Analysis", breadcrumb: ["Dashboard", "Repositories", "frontend-platform", "Analysis"] },
  "knowledge-graph": { label: "Knowledge Graph", breadcrumb: ["Dashboard", "Repositories", "frontend-platform", "Graph Explorer"] },
};

const dashboardData = {
  user: "Arjun",
  workspace: "Northstar Platform",
  stats: [
    ["Projects", "12", "+2 this week", T.success],
    ["Repositories", "48", "+6 connected", T.success],
    ["Files Analyzed", "128.4k", "+18%", T.success],
    ["Functions Indexed", "42,817", "+3,204", T.success],
    ["Dependencies Found", "9,642", "+411", T.info],
    ["Architecture Graphs", "34", "+5 generated", T.success],
    ["Analyses Completed", "216", "+24 today", T.success],
    ["Avg. Repository Health", "86%", "-3 pts", T.warning],
  ],
  repos: [
    { name: "main-api", language: "TypeScript", branch: "main", status: "Attention", last: "12 min ago", score: 74, risk: "Medium", color: T.warning },
    { name: "payments-service", language: "Go", branch: "release/2.4", status: "Healthy", last: "38 min ago", score: 92, risk: "Low", color: T.success },
    { name: "auth-gateway", language: "Java", branch: "main", status: "Critical path", last: "1 hr ago", score: 61, risk: "High", color: T.error },
  ],
  activity: [
    ["Repository Uploaded", "frontend-platform", "2 min ago", Icons.repos],
    ["Analysis Completed", "payments-service", "18 min ago", Icons.check],
    ["Dependency Graph Generated", "main-api", "44 min ago", Icons.deps],
    ["Architecture Updated", "auth-gateway", "1 hr ago", Icons.arch],
    ["Project Created", "mobile-suite", "3 hr ago", Icons.projects],
    ["Future AI Analysis Placeholder", "search-indexer", "Soon", Icons.ai],
  ],
  recent: [
    ["main-api", "Today, 4:18 PM", "TypeScript", 72],
    ["auth-gateway", "Today, 2:03 PM", "Java", 58],
    ["data-pipeline", "Yesterday", "Python", 91],
  ],
  queue: [
    { repo: "frontend-platform", progress: 68, eta: "4 min", step: "Parsing Code" },
    { repo: "search-indexer", progress: 42, eta: "9 min", step: "Scanning Files" },
  ],
  languages: [
    ["Python", 28, "#58A6FF"],
    ["TypeScript", 24, T.accentBright],
    ["JavaScript", 17, "#D29922"],
    ["Go", 13, "#79C0FF"],
    ["Java", 11, "#F0883E"],
    ["Rust", 7, "#F85149"],
  ],
  risks: [
    ["Critical Repositories", "3", T.error],
    ["Medium Risk", "9", T.warning],
    ["Healthy Projects", "18", T.success],
    ["Pending Analysis", "7", T.info],
  ],
  favorites: [
    ["payments-service", "92% health"],
    ["main-api", "3 queued tasks"],
    ["frontend-platform", "analysis running"],
  ],
};

export { NAV_ITEMS, PAGE_META, dashboardData };
