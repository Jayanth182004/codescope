import re

with open('CodeScopeApp.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

deps_code = """
/* ═══════════════════════════════════════════════════════════════════════════
   PROMPT 10: DEPENDENCY INTELLIGENCE EXPLORER
═══════════════════════════════════════════════════════════════════════════ */

const dependencyMockData = {
  nodes: [
    { id: "API Gateway", type: "customDep", position: { x: 400, y: 50 }, data: { label: "API Gateway", type: "Service", lang: "Go", risk: "Low", fanIn: 1, fanOut: 2, files: 1, functions: 4, classes: 0, modules: 1, apis: 3, services: 1, loc: "gateway/main.go", updated: "2 hrs ago" } },
    { id: "UserController", type: "customDep", position: { x: 300, y: 150 }, data: { label: "UserController", type: "Class", lang: "TypeScript", risk: "Medium", fanIn: 2, fanOut: 1, files: 3, functions: 12, classes: 2, modules: 1, apis: 5, services: 0, loc: "src/controllers/UserController.ts", updated: "1 day ago" } },
    { id: "UserService", type: "customDep", position: { x: 400, y: 250 }, data: { label: "UserService", type: "Class", lang: "TypeScript", risk: "High", fanIn: 3, fanOut: 2, files: 14, functions: 38, classes: 4, modules: 2, apis: 1, services: 1, loc: "src/services/UserService.ts", updated: "3 days ago" } },
    { id: "AuthMiddleware", type: "customDep", position: { x: 100, y: 150 }, data: { label: "AuthMiddleware", type: "Function", lang: "TypeScript", risk: "Medium", fanIn: 1, fanOut: 1, files: 4, functions: 6, classes: 0, modules: 1, apis: 2, services: 0, loc: "src/middleware/auth.ts", updated: "1 week ago" } },
    { id: "UserRepository", type: "customDep", position: { x: 400, y: 350 }, data: { label: "UserRepository", type: "Class", lang: "TypeScript", risk: "Medium", fanIn: 2, fanOut: 1, files: 2, functions: 15, classes: 1, modules: 1, apis: 0, services: 0, loc: "src/repos/UserRepository.ts", updated: "2 days ago" } },
    { id: "Database", type: "customDep", position: { x: 400, y: 450 }, data: { label: "UsersTable", type: "Database Table", lang: "SQL", risk: "Critical", fanIn: 4, fanOut: 0, files: 28, functions: 112, classes: 14, modules: 4, apis: 8, services: 2, loc: "db:users", updated: "1 month ago" } },
    { id: "RedisCache", type: "customDep", position: { x: 600, y: 350 }, data: { label: "SessionCache", type: "Database Table", lang: "Redis", risk: "Low", fanIn: 2, fanOut: 0, files: 4, functions: 10, classes: 2, modules: 1, apis: 0, services: 0, loc: "cache:sessions", updated: "3 mos ago" } },
    { id: "Logger", type: "customDep", position: { x: 100, y: 350 }, data: { label: "Logger", type: "Module", lang: "TypeScript", risk: "Low", fanIn: 8, fanOut: 0, files: 120, functions: 450, classes: 32, modules: 15, apis: 0, services: 0, loc: "src/utils/logger.ts", updated: "1 year ago" } },
    { id: "PaymentService", type: "customDep", position: { x: 700, y: 250 }, data: { label: "PaymentService", type: "Service", lang: "Java", risk: "Critical", fanIn: 1, fanOut: 1, files: 45, functions: 180, classes: 30, modules: 8, apis: 12, services: 3, loc: "billing/PaymentService.java", updated: "4 hrs ago" } },
    { id: "AppConfig", type: "customDep", position: { x: 100, y: 50 }, data: { label: "config.json", type: "Configuration File", lang: "JSON", risk: "Critical", fanIn: 12, fanOut: 0, files: 140, functions: 0, classes: 0, modules: 20, apis: 0, services: 5, loc: "config/default.json", updated: "5 days ago" } },
    { id: "ENV_URL", type: "customDep", position: { x: -100, y: 50 }, data: { label: "DATABASE_URL", type: "Environment Variable", lang: "ENV", risk: "Critical", fanIn: 5, fanOut: 0, files: 12, functions: 0, classes: 0, modules: 4, apis: 0, services: 2, loc: ".env", updated: "6 mos ago" } },
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
  ]
};

const dependencyTree = [
  { id: "AppConfig", name: "config.json", type: "Configuration File", children: [] },
  { id: "ENV_URL", name: "DATABASE_URL", type: "Environment Variable", children: [] },
  { id: "API Gateway", name: "API Gateway", type: "Service", children: [
    { id: "UserController", name: "UserController", type: "Class", children: [
      { id: "UserService", name: "UserService", type: "Class", children: [
        { id: "UserRepository", name: "UserRepository", type: "Class", children: [
          { id: "Database", name: "UsersTable", type: "Database Table", children: [] }
        ]},
        { id: "RedisCache", name: "SessionCache", type: "Database Table", children: [] },
        { id: "Logger", name: "Logger", type: "Module", children: [] }
      ]}
    ]},
    { id: "AuthMiddleware", name: "AuthMiddleware", type: "Function", children: [] }
  ]},
  { id: "PaymentService", name: "PaymentService", type: "Service", children: [] }
];

const getDepEdgeStyle = (label, selectedNodeId, source, target) => {
  let color = T.dim;
  let strokeDasharray = "0";
  let animated = false;

  if (label === "imports" || label === "read by" || label === "configures") { color = T.warning; strokeDasharray = "5 5"; }
  if (label === "calls" || label === "routes to") { color = T.info; animated = true; }
  if (label === "depends on") { color = T.error; strokeDasharray = "2 4"; }
  if (label === "queries") { color = T.success; animated = true; }
  if (label === "uses") { color = T.accentBright; }

  let opacity = 1;
  if (selectedNodeId) {
    if (source !== selectedNodeId && target !== selectedNodeId) {
      opacity = 0.15;
    } else {
      color = T.text;
      if (source === selectedNodeId) color = T.info; 
      if (target === selectedNodeId) color = T.warning; 
    }
  }

  return { style: { stroke: color, strokeDasharray, opacity, strokeWidth: selectedNodeId ? 2 : 1 }, animated };
};

const CustomDepNode = ({ data, selected }) => {
  let bgColor = T.surfaceEl;
  let borderColor = T.border;
  let icon = Icons.file;
  
  if (data.type === "Service" || data.type === "API Endpoint") { borderColor = "#f771a3"; icon = Icons.arch; }
  if (data.type === "Class") { bgColor = "#1e1e24"; borderColor = T.warning; }
  if (data.type === "Function") { bgColor = "#1a221d"; borderColor = T.success; }
  if (data.type === "Database Table") { bgColor = "#2d1b1b"; borderColor = T.error; icon = Icons.database; }
  if (data.type === "Module" || data.type === "Package") { borderColor = T.info; icon = Icons.gridView; }
  if (data.type === "Configuration File") { borderColor = "#a371f7"; icon = Icons.settings; }
  if (data.type === "Environment Variable") { bgColor = "#261a29"; borderColor = "#a371f7"; icon = Icons.arch; }

  const riskColor = data.risk === "Critical" ? T.error : data.risk === "High" ? T.warning : data.risk === "Medium" ? T.info : T.success;

  return (
    <div 
      style={{
      padding: "10px 14px",
      background: bgColor,
      border: `1px solid ${selected ? T.text : borderColor}`,
      borderRadius: T.r6,
      display: "flex",
      alignItems: "center",
      gap: 12,
      minWidth: 160,
      boxShadow: selected ? `0 0 0 2px ${T.accentSoft}` : T.shadow,
      transition: "all 0.2s ease",
      opacity: data.hidden ? 0.2 : 1
    }}>
      <Handle type="target" position={Position.Top} style={{ background: T.faint, border: "none", width: 8, height: 8 }} />
      <div style={{ color: selected ? T.text : T.faint }}>
        <icon.type {...icon.props} size={16} />
      </div>
      <div style={{ flex: 1 }}>
        {!data.hideLabel && <div style={{ fontSize: 13, fontWeight: 500, color: T.text, fontFamily: T.mono }}>{data.label}</div>}
        <div style={{ fontSize: 11, color: T.dim }}>{data.type}</div>
      </div>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: riskColor }} title={`Risk: ${data.risk}`} />
      <Handle type="source" position={Position.Bottom} style={{ background: T.faint, border: "none", width: 8, height: 8 }} />
    </div>
  );
};

const depNodeTypes = { customDep: CustomDepNode };

function DependencyIntelligencePage({ setActivePage }) {
  const [status, setStatus] = useState("success");
  return (
    <ReactFlowProvider>
      <DependencyIntelligenceInner status={status} setStatus={setStatus} />
    </ReactFlowProvider>
  );
}

function DependencyTreeItem({ item, depth = 0 }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = item.children && item.children.length > 0;
  
  return (
    <div style={{ paddingLeft: depth * 16 }}>
      <div 
        onClick={() => setExpanded(!expanded)}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", cursor: hasChildren ? "pointer" : "default", borderRadius: T.r4, background: "transparent" }}
        onMouseEnter={e => e.currentTarget.style.background = T.surfaceHov}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        <div style={{ width: 16, display: "flex", alignItems: "center", justifyContent: "center", color: T.faint }}>
          {hasChildren ? (expanded ? <Icons.chevronDown size={14}/> : <Icons.chevronRight size={14}/>) : <span style={{width: 14}}/>}
        </div>
        <Icons.file size={14} color={T.dim} />
        <span style={{ fontSize: 13, color: T.text, fontFamily: T.mono }}>{item.name}</span>
        <span style={{ fontSize: 11, color: T.faint }}>{item.type}</span>
      </div>
      {expanded && hasChildren && (
        <div>
          {item.children.map(child => <DependencyTreeItem key={child.id} item={child} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}

function DependencyIntelligenceInner({ status, setStatus }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  
  // Advanced Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRel, setFilterRel] = useState("All");
  const [filterLang, setFilterLang] = useState("All");
  const [filterRisk, setFilterRisk] = useState("All");
  const [filterDepth, setFilterDepth] = useState("All");
  const [showLabels, setShowLabels] = useState(true);
  
  const { fitView } = useReactFlow();

  useEffect(() => {
    const filteredNodes = dependencyMockData.nodes.map(node => {
      const matchSearch = node.data.label.toLowerCase().includes(searchTerm.toLowerCase());
      const matchLang = filterLang === "All" || node.data.lang === filterLang;
      const matchRisk = filterRisk === "All" || node.data.risk === filterRisk;
      const isVisible = matchSearch && matchLang && matchRisk;
      
      return {
        ...node,
        data: { ...node.data, hidden: !isVisible, hideLabel: !showLabels }
      };
    });

    const filteredEdges = dependencyMockData.edges.map(edge => {
      const matchRel = filterRel === "All" || edge.label === filterRel;
      
      const sourceVisible = filteredNodes.find(n => n.id === edge.source && !n.data.hidden);
      const targetVisible = filteredNodes.find(n => n.id === edge.target && !n.data.hidden);
      const isVisible = matchRel && sourceVisible && targetVisible;

      const edgeStyleProps = getDepEdgeStyle(edge.label, selectedNodeId, edge.source, edge.target);

      return {
        ...edge,
        type: "smoothstep",
        hidden: !isVisible,
        ...edgeStyleProps
      };
    });

    setNodes(filteredNodes);
    setEdges(filteredEdges);
  }, [searchTerm, filterLang, filterRisk, filterRel, showLabels, selectedNodeId, setNodes, setEdges]);

  useEffect(() => {
    setTimeout(() => fitView({ duration: 800, padding: 0.2 }), 50);
  }, [searchTerm, filterLang, filterRisk, filterRel, showLabels, fitView]);

  const onNodeClick = (_, node) => setSelectedNodeId(node.id);
  const onPaneClick = () => setSelectedNodeId(null);

  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;

  if (status === "loading") return <GraphLoadingState />;
  if (status === "empty") return <GraphEmptyState onRun={() => setStatus("running")} />;
  if (status === "error") return <GraphErrorState onRetry={() => setStatus("success")} />;

  return (
    <div style={{ display: "flex", height: "100%", flexDirection: "column" }}>
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        
        {/* Left Sidebar - Dependency Tree & Filters */}
        <div style={{ width: 280, borderRight: `1px solid ${T.border}`, background: T.surface, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 16, borderBottom: `1px solid ${T.border}` }}>
            <h3 style={{ fontSize: 14, fontWeight: 500, color: T.text, marginBottom: 12 }}>Filters</h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: 10, top: 8, color: T.faint }}><Icons.search size={14} /></div>
                <input 
                  aria-label="Search dependencies"
                  type="text" 
                  placeholder="Search function, class, api..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ width: "100%", padding: "6px 12px 6px 30px", background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, color: T.text, fontSize: 13, outline: "none" }}
                />
              </div>

              <div>
                <div style={{ marginBottom: 4, fontSize: 11, color: T.dim }}>Relationship Type</div>
                <select value={filterRel} onChange={e => setFilterRel(e.target.value)} style={{ width: "100%", padding: "6px", background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r4, color: T.text, fontSize: 12, outline: "none" }}>
                  <option value="All">All Relationships</option>
                  <option value="imports">Imports / Imported By</option>
                  <option value="calls">Calls / Called By</option>
                  <option value="uses">Uses / Used By</option>
                  <option value="depends on">Depends On</option>
                  <option value="queries">Queries</option>
                </select>
              </div>

              <div>
                <div style={{ marginBottom: 4, fontSize: 11, color: T.dim }}>Risk Level</div>
                <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)} style={{ width: "100%", padding: "6px", background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r4, color: T.text, fontSize: 12, outline: "none" }}>
                  <option value="All">All Risks</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              <div>
                <div style={{ marginBottom: 4, fontSize: 11, color: T.dim }}>Language</div>
                <select value={filterLang} onChange={e => setFilterLang(e.target.value)} style={{ width: "100%", padding: "6px", background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r4, color: T.text, fontSize: 12, outline: "none" }}>
                  <option value="All">All Languages</option>
                  <option value="TypeScript">TypeScript</option>
                  <option value="Go">Go</option>
                  <option value="Java">Java</option>
                  <option value="SQL">SQL</option>
                </select>
              </div>

            </div>
          </div>
          
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 8px" }}>
            <h3 style={{ fontSize: 12, fontWeight: 500, color: T.dim, marginBottom: 8, paddingLeft: 8, textTransform: "uppercase" }}>Dependency Tree</h3>
            {dependencyTree.map(root => (
              <DependencyTreeItem key={root.id} item={root} />
            ))}
          </div>
        </div>

        {/* Center Canvas */}
        <div style={{ flex: 1, position: "relative", background: T.bg }}>
          <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 10, display: "flex", gap: 8, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: "6px 8px", boxShadow: T.shadow }}>
            <button onClick={() => setShowLabels(!showLabels)} style={{ padding: "4px 8px", background: "none", color: showLabels ? T.text : T.dim, border: "none", cursor: "pointer", fontSize: 12 }}>
              {showLabels ? "Hide Labels" : "Show Labels"}
            </button>
            <div style={{ width: 1, background: T.border }}></div>
            <button onClick={() => { setSearchTerm(""); setFilterRel("All"); setFilterRisk("All"); setFilterLang("All"); setSelectedNodeId(null); }} style={{ padding: "4px 8px", background: "none", color: T.text, border: "none", cursor: "pointer", fontSize: 12 }}>
              Reset Focus
            </button>
            <div style={{ width: 1, background: T.border }}></div>
            <button onClick={() => fitView({ duration: 800, padding: 0.2 })} style={{ padding: "4px 8px", background: "none", color: T.text, border: "none", cursor: "pointer", fontSize: 12 }}>
              Center View
            </button>
          </div>

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={depNodeTypes}
            fitView
            attributionPosition="bottom-right"
            theme="dark"
          >
            <Background color={T.border} gap={20} size={1} />
            <Controls style={{ display: 'flex', flexDirection: 'column', backgroundColor: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r6, overflow: 'hidden' }} />
            <MiniMap 
              nodeColor={n => n.data.risk === 'Critical' ? T.error : n.data.risk === 'High' ? T.warning : T.surfaceEl}
              style={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r6 }}
              maskColor="rgba(0,0,0,0.5)"
            />
          </ReactFlow>
        </div>

        {/* Right Sidebar - Blast Radius Panel */}
        <div style={{ width: 340, borderLeft: `1px solid ${T.border}`, background: T.surface, display: "flex", flexDirection: "column", overflowY: "auto" }}>
          {selectedNode ? (
            <div style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: T.r6, background: T.surfaceEl, display: "flex", alignItems: "center", justifyContent: "center", color: T.text }}>
                  <Icons.arch size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: T.text, fontFamily: T.mono }}>{selectedNode.data.label}</div>
                  <div style={{ fontSize: 12, color: T.dim }}>{selectedNode.data.type} &middot; {selectedNode.data.lang}</div>
                </div>
              </div>

              {/* Node Details */}
              <div style={{ fontSize: 12, color: T.dim, marginBottom: 8, textTransform: "uppercase" }}>Location</div>
              <div style={{ background: T.surfaceEl, borderRadius: T.r6, padding: 12, marginBottom: 24, fontSize: 12, color: T.text, fontFamily: T.mono }}>
                {selectedNode.data.loc}
                <div style={{ fontSize: 10, color: T.faint, fontFamily: T.sans, marginTop: 4 }}>Last updated: {selectedNode.data.updated}</div>
              </div>

              {/* Blast Radius Widget */}
              <div style={{ background: selectedNode.data.risk === 'Critical' ? "rgba(248,81,73,0.1)" : selectedNode.data.risk === 'High' ? "rgba(210,153,34,0.1)" : T.surfaceEl, border: `1px solid ${selectedNode.data.risk === 'Critical' ? T.error : selectedNode.data.risk === 'High' ? T.warning : T.border}`, borderRadius: T.r6, padding: 16, marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Icons.alertTriangle size={16} color={selectedNode.data.risk === 'Critical' ? T.error : selectedNode.data.risk === 'High' ? T.warning : selectedNode.data.risk === 'Medium' ? T.info : T.success} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Blast Radius: {selectedNode.data.risk} Risk</span>
                </div>
                
                <div style={{ fontSize: 12, color: T.dim, lineHeight: 1.5, marginBottom: 16 }}>
                  {selectedNode.data.risk === 'Critical' ? "Modifying this will cause sweeping, potentially dangerous downstream effects across multiple domain boundaries." : 
                   selectedNode.data.risk === 'High' ? "Modifying this affects major subsystems and requires deep architectural review." :
                   selectedNode.data.risk === 'Medium' ? "Modifying this affects localized components. Ensure unit tests pass." :
                   "Modifying this has minimal isolated impact. Safe to refactor."}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <div style={{ background: T.surface, padding: "6px", borderRadius: T.r4, border: `1px solid ${T.border}`, textAlign: "center" }}>
                    <div style={{ fontSize: 14, color: T.text, fontFamily: T.mono }}>{selectedNode.data.files}</div>
                    <div style={{ fontSize: 9, color: T.dim, textTransform: "uppercase" }}>Files</div>
                  </div>
                  <div style={{ background: T.surface, padding: "6px", borderRadius: T.r4, border: `1px solid ${T.border}`, textAlign: "center" }}>
                    <div style={{ fontSize: 14, color: T.text, fontFamily: T.mono }}>{selectedNode.data.functions}</div>
                    <div style={{ fontSize: 9, color: T.dim, textTransform: "uppercase" }}>Funcs</div>
                  </div>
                  <div style={{ background: T.surface, padding: "6px", borderRadius: T.r4, border: `1px solid ${T.border}`, textAlign: "center" }}>
                    <div style={{ fontSize: 14, color: T.text, fontFamily: T.mono }}>{selectedNode.data.classes}</div>
                    <div style={{ fontSize: 9, color: T.dim, textTransform: "uppercase" }}>Classes</div>
                  </div>
                  <div style={{ background: T.surface, padding: "6px", borderRadius: T.r4, border: `1px solid ${T.border}`, textAlign: "center" }}>
                    <div style={{ fontSize: 14, color: T.text, fontFamily: T.mono }}>{selectedNode.data.modules}</div>
                    <div style={{ fontSize: 9, color: T.dim, textTransform: "uppercase" }}>Modules</div>
                  </div>
                  <div style={{ background: T.surface, padding: "6px", borderRadius: T.r4, border: `1px solid ${T.border}`, textAlign: "center" }}>
                    <div style={{ fontSize: 14, color: T.text, fontFamily: T.mono }}>{selectedNode.data.apis}</div>
                    <div style={{ fontSize: 9, color: T.dim, textTransform: "uppercase" }}>APIs</div>
                  </div>
                  <div style={{ background: T.surface, padding: "6px", borderRadius: T.r4, border: `1px solid ${T.border}`, textAlign: "center" }}>
                    <div style={{ fontSize: 14, color: T.text, fontFamily: T.mono }}>{selectedNode.data.services}</div>
                    <div style={{ fontSize: 9, color: T.dim, textTransform: "uppercase" }}>Services</div>
                  </div>
                </div>
              </div>
              
              <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
                <DashButton icon={Icons.search} label="Open File" variant="secondary" onClick={() => {}} style={{ flex: 1 }} />
                <DashButton icon={Icons.arch} label="View Arch" variant="secondary" onClick={() => {}} style={{ flex: 1 }} />
              </div>

              {/* Connections Lists */}
              <div style={{ fontSize: 12, color: T.dim, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>Depended On By (Incoming: {selectedNode.data.fanIn})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
                {edges.filter(e => e.target === selectedNode.id).map(e => {
                  const other = nodes.find(n => n.id === e.source);
                  if(!other) return null;
                  return (
                    <div key={e.id} style={{ background: T.surfaceEl, borderRadius: T.r4, padding: "6px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 12, fontFamily: T.mono, color: T.text }}>{other.data.label}</div>
                      <div style={{ fontSize: 10, color: T.warning }}>{e.label}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ fontSize: 12, color: T.dim, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>Depends On (Outgoing: {selectedNode.data.fanOut})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {edges.filter(e => e.source === selectedNode.id).map(e => {
                  const other = nodes.find(n => n.id === e.target);
                  if(!other) return null;
                  return (
                    <div key={e.id} style={{ background: T.surfaceEl, borderRadius: T.r4, padding: "6px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 10, color: T.info }}>{e.label}</div>
                      <div style={{ fontSize: 12, fontFamily: T.mono, color: T.text }}>{other.data.label}</div>
                    </div>
                  );
                })}
              </div>

            </div>
          ) : (
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: T.text, marginBottom: 16 }}>Repository Statistics</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <StatRow label="Total Dependencies" val="9,642" />
                <StatRow label="Circular Dependencies" val="12" />
                <StatRow label="SCCs (Strongly Connected)" val="3" />
                <StatRow label="Highest Fan-In" val="Logger (8)" />
                <StatRow label="Highest Fan-Out" val="UserService (2)" />
                <StatRow label="Most Referenced File" val="config.json" />
                <StatRow label="Most Referenced Function" val="formatDate" />
              </div>
              <div style={{ marginTop: 40, textAlign: "center", color: T.faint, fontSize: 13, padding: 20, background: T.surfaceEl, borderRadius: T.r6 }}>
                <Icons.arch size={24} style={{ marginBottom: 12, opacity: 0.5 }} />
                <br/>
                Select a node to inspect its blast radius and specific dependency paths.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
"""

# Completely strip out the old empty prompt 10 attempt if it somehow got in
if "function DependencyIntelligenceInner" in content:
    # Just replace it with regex so it's clean
    content = re.sub(
        r'const dependencyMockData = \{.*?/\* ═══════════════════════════════════════════════════════════════════════════ \*/',
        deps_code.strip(),
        content,
        flags=re.DOTALL
    )
else:
    # We know it wasn't appended because "DependencyIntelligencePage" was already in PageStub!
    # So we must append it right before the ROOT ROUTER
    content = content.replace(
        "/* ═══════════════════════════════════════════════════════════════════════════\n   ROOT ROUTER",
        deps_code + "\n/* ═══════════════════════════════════════════════════════════════════════════\n   ROOT ROUTER"
    )

with open('CodeScopeApp.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Prompt 10 perfection patch applied!")
