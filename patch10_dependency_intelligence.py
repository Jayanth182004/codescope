import re

with open('CodeScopeApp.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add alertTriangle icon if not exists
if 'alertTriangle:' not in content:
    content = re.sub(
        r'(const Icons = \{)',
        r'\1\n  alertTriangle: () => <Icon d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />,\n  eye: () => <Icon d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />,',
        content, count=1
    )

# 2. Add routing in PageStub
if 'if (pageId === "deps") return <DependencyIntelligencePage setActivePage={setActivePage} />;' not in content:
    content = re.sub(
        r'(function PageStub\(\{ pageId, setActivePage \}\) \{\s*)',
        r'\1if (pageId === "deps") return <DependencyIntelligencePage setActivePage={setActivePage} />;\n  ',
        content, count=1
    )

# 3. Add DependencyIntelligence components
deps_code = """
/* ═══════════════════════════════════════════════════════════════════════════
   PROMPT 10: DEPENDENCY INTELLIGENCE EXPLORER
═══════════════════════════════════════════════════════════════════════════ */

const dependencyMockData = {
  nodes: [
    { id: "API Gateway", type: "customDep", position: { x: 300, y: 50 }, data: { label: "API Gateway", type: "Service", lang: "Go", risk: "Low", fanIn: 1, fanOut: 2 } },
    { id: "UserController", type: "customDep", position: { x: 300, y: 150 }, data: { label: "UserController", type: "Class", lang: "TypeScript", risk: "Low", fanIn: 2, fanOut: 1 } },
    { id: "UserService", type: "customDep", position: { x: 300, y: 250 }, data: { label: "UserService", type: "Class", lang: "TypeScript", risk: "High", fanIn: 3, fanOut: 2 } },
    { id: "AuthMiddleware", type: "customDep", position: { x: 100, y: 150 }, data: { label: "AuthMiddleware", type: "Function", lang: "TypeScript", risk: "Medium", fanIn: 1, fanOut: 1 } },
    { id: "UserRepository", type: "customDep", position: { x: 300, y: 350 }, data: { label: "UserRepository", type: "Class", lang: "TypeScript", risk: "Medium", fanIn: 2, fanOut: 1 } },
    { id: "Database", type: "customDep", position: { x: 300, y: 450 }, data: { label: "UsersTable", type: "Database Table", lang: "SQL", risk: "Critical", fanIn: 4, fanOut: 0 } },
    { id: "RedisCache", type: "customDep", position: { x: 500, y: 350 }, data: { label: "SessionCache", type: "Database Table", lang: "Redis", risk: "Low", fanIn: 2, fanOut: 0 } },
    { id: "Logger", type: "customDep", position: { x: 100, y: 350 }, data: { label: "Logger", type: "Module", lang: "TypeScript", risk: "Low", fanIn: 8, fanOut: 0 } },
    { id: "PaymentService", type: "customDep", position: { x: 600, y: 250 }, data: { label: "PaymentService", type: "Service", lang: "Java", risk: "Critical", fanIn: 1, fanOut: 1 } },
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
  ]
};

// Tree Structure
const dependencyTree = [
  { id: "UserService", name: "UserService", type: "Class", children: [
    { id: "UserRepository", name: "UserRepository", type: "Class", children: [
      { id: "Database", name: "UsersTable", type: "Database Table", children: [] }
    ]},
    { id: "RedisCache", name: "SessionCache", type: "Database Table", children: [] },
    { id: "Logger", name: "Logger", type: "Module", children: [] }
  ]}
];

const getDepEdgeStyle = (label, selectedNodeId, source, target) => {
  let color = T.dim;
  let strokeDasharray = "0";
  let animated = false;

  if (label === "imports") { color = T.warning; strokeDasharray = "5 5"; }
  if (label === "calls") { color = T.info; animated = true; }
  if (label === "depends on") { color = T.error; strokeDasharray = "2 4"; }
  if (label === "queries") { color = T.success; animated = true; }
  if (label === "uses") { color = T.accentBright; }

  let opacity = 1;
  if (selectedNodeId) {
    if (source !== selectedNodeId && target !== selectedNodeId) {
      opacity = 0.15;
    } else {
      color = T.text;
      if (source === selectedNodeId) color = T.info; // Outgoing
      if (target === selectedNodeId) color = T.warning; // Incoming
    }
  }

  return { style: { stroke: color, strokeDasharray, opacity, strokeWidth: selectedNodeId ? 2 : 1 }, animated };
};

const CustomDepNode = ({ data, selected }) => {
  let bgColor = T.surfaceEl;
  let borderColor = T.border;
  let icon = Icons.file;
  
  if (data.type === "Service") { borderColor = "#f771a3"; icon = Icons.arch; }
  if (data.type === "Class") { bgColor = "#1e1e24"; borderColor = T.warning; }
  if (data.type === "Function") { bgColor = "#1a221d"; borderColor = T.success; }
  if (data.type === "Database Table") { bgColor = "#2d1b1b"; borderColor = T.error; icon = Icons.database; }
  if (data.type === "Module") { borderColor = T.info; icon = Icons.gridView; }

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
  
  const [searchTerm, setSearchTerm] = useState("");
  const [showLabels, setShowLabels] = useState(true);
  
  const { fitView } = useReactFlow();

  useEffect(() => {
    const filteredNodes = dependencyMockData.nodes.map(node => {
      const matchSearch = node.data.label.toLowerCase().includes(searchTerm.toLowerCase());
      return {
        ...node,
        data: { ...node.data, hidden: !matchSearch, hideLabel: !showLabels }
      };
    });

    const filteredEdges = dependencyMockData.edges.map(edge => {
      const edgeStyleProps = getDepEdgeStyle(edge.label, selectedNodeId, edge.source, edge.target);
      return {
        ...edge,
        type: "smoothstep",
        ...edgeStyleProps
      };
    });

    setNodes(filteredNodes);
    setEdges(filteredEdges);
  }, [searchTerm, showLabels, selectedNodeId, setNodes, setEdges]);

  useEffect(() => {
    setTimeout(() => fitView({ duration: 800, padding: 0.2 }), 50);
  }, [searchTerm, showLabels, fitView]);

  const onNodeClick = (_, node) => setSelectedNodeId(node.id);
  const onPaneClick = () => setSelectedNodeId(null);

  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;

  if (status === "loading") return <GraphLoadingState />;
  if (status === "empty") return <GraphEmptyState onRun={() => setStatus("running")} />;
  if (status === "error") return <GraphErrorState onRetry={() => setStatus("success")} />;

  return (
    <div style={{ display: "flex", height: "100%", flexDirection: "column" }}>
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        
        {/* Left Sidebar - Dependency Tree */}
        <div style={{ width: 280, borderRight: `1px solid ${T.border}`, background: T.surface, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 16, borderBottom: `1px solid ${T.border}` }}>
            <h3 style={{ fontSize: 14, fontWeight: 500, color: T.text, marginBottom: 12 }}>Dependency Tree</h3>
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", left: 10, top: 8, color: T.faint }}><Icons.search size={14} /></div>
              <input 
                aria-label="Search dependencies"
                type="text" 
                placeholder="Search..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ width: "100%", padding: "6px 12px 6px 30px", background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, color: T.text, fontSize: 13, outline: "none" }}
              />
            </div>
          </div>
          
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 8px" }}>
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
            <button onClick={() => { setSearchTerm(""); setSelectedNodeId(null); }} style={{ padding: "4px 8px", background: "none", color: T.text, border: "none", cursor: "pointer", fontSize: 12 }}>
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
              nodeColor={n => n.data.risk === 'Critical' ? T.error : T.surfaceEl}
              style={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r6 }}
              maskColor="rgba(0,0,0,0.5)"
            />
          </ReactFlow>
        </div>

        {/* Right Sidebar - Blast Radius Panel */}
        <div style={{ width: 320, borderLeft: `1px solid ${T.border}`, background: T.surface, display: "flex", flexDirection: "column", overflowY: "auto" }}>
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

              {/* Blast Radius Widget */}
              <div style={{ background: selectedNode.data.risk === 'Critical' ? "rgba(248,81,73,0.1)" : selectedNode.data.risk === 'High' ? "rgba(210,153,34,0.1)" : T.surfaceEl, border: `1px solid ${selectedNode.data.risk === 'Critical' ? T.error : selectedNode.data.risk === 'High' ? T.warning : T.border}`, borderRadius: T.r6, padding: 16, marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Icons.alertTriangle size={16} color={selectedNode.data.risk === 'Critical' ? T.error : selectedNode.data.risk === 'High' ? T.warning : T.success} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Blast Radius: {selectedNode.data.risk} Risk</span>
                </div>
                <div style={{ fontSize: 12, color: T.dim, lineHeight: 1.5, marginBottom: 12 }}>
                  Modifying this {selectedNode.data.type.toLowerCase()} will directly affect {selectedNode.data.fanIn} incoming dependencies and {selectedNode.data.fanOut} outgoing links.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div style={{ background: T.surface, padding: "8px 12px", borderRadius: T.r4, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 18, color: T.text, fontFamily: T.mono }}>{selectedNode.data.fanIn}</div>
                    <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase" }}>Incoming</div>
                  </div>
                  <div style={{ background: T.surface, padding: "8px 12px", borderRadius: T.r4, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 18, color: T.text, fontFamily: T.mono }}>{selectedNode.data.fanOut}</div>
                    <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase" }}>Outgoing</div>
                  </div>
                </div>
              </div>
              
              <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
                <DashButton icon={Icons.search} label="Open Source" variant="secondary" onClick={() => {}} style={{ flex: 1 }} />
                <DashButton icon={Icons.impact} label="Full Impact" variant="secondary" onClick={() => {}} style={{ flex: 1 }} />
              </div>

              {/* Connections Lists */}
              <div style={{ fontSize: 12, color: T.dim, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>Depended On By (Incoming)</div>
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

              <div style={{ fontSize: 12, color: T.dim, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>Depends On (Outgoing)</div>
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
                <StatRow label="Avg Depth" val="4.2" />
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
if "DependencyIntelligencePage" not in content:
    content += "\n" + deps_code

with open('CodeScopeApp.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Dependency Intelligence explorer generated successfully!")
