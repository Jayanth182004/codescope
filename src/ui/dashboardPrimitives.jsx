import { useState } from "react";
import { Icons, T } from "./foundation.jsx";
function DashButton({ children, icon: IconSlot, label, variant = "ghost", onClick, title, type = "button", style }) {
  const isPrimary = variant === "primary";
  return (
    <button
      onClick={onClick}
      type={type}
      title={title}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
        minHeight: 34, padding: "8px 12px", borderRadius: T.r6, cursor: "pointer",
        border: `1px solid ${isPrimary ? T.accentBorder : T.border}`,
        background: isPrimary ? T.accent : T.surfaceEl,
        color: isPrimary ? "#fff" : T.dim, fontSize: 12, fontWeight: 500,
        ...style,
      }}
    >
      {IconSlot && <IconSlot />}
      {label || children}
    </button>
  );
}

function Pill({ children, color = T.dim }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px",
      borderRadius: T.r12, border: `1px solid ${color}55`, background: `${color}16`,
      color, fontSize: 11, fontWeight: 500, whiteSpace: "nowrap"
    }}>{children}</span>
  );
}

function ProgressBar({ value, color = T.accentBright, animated = false }) {
  return (
    <div aria-label={`${value}% complete`} style={{ height: 7, borderRadius: 999, background: T.bg, border: `1px solid ${T.border}`, overflow: "hidden" }}>
      <div
        className={animated ? "dash-progress-fill" : ""}
        style={{
          width: `${value}%`, height: "100%", borderRadius: 999,
          background: animated
            ? `linear-gradient(90deg, ${color}, ${T.accentBright}, ${color})`
            : color,
        }}
      />
    </div>
  );
}

function WidgetShell({ title, children, action, loading, empty, error }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <section className="dash-card" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, overflow: "hidden" }}>
      <div style={{ minHeight: 48, padding: "12px 14px", borderBottom: collapsed ? "none" : `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: T.text, letterSpacing: "-0.01em", flex: 1 }}>{title}</h2>
        {action}
        <button aria-label={`Refresh ${title}`} title="Refresh" style={{ background: "none", border: "none", color: T.faint, cursor: "pointer", display: "flex", padding: 5 }}><Icons.git /></button>
        <button aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`} title={collapsed ? "Expand" : "Collapse"} onClick={() => setCollapsed(c => !c)} style={{ background: "none", border: "none", color: T.faint, cursor: "pointer", display: "flex", padding: 5 }}>
          {collapsed ? <Icons.chevronRight /> : <Icons.chevronDown />}
        </button>
      </div>
      {!collapsed && (
        <div style={{ padding: 14 }}>
          {loading ? <WidgetLoading /> : error ? <WidgetError /> : empty ? <WidgetEmpty /> : children}
        </div>
      )}
    </section>
  );
}

function WidgetLoading() {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="dash-skeleton" style={{ height: 16, width: "45%" }} />
      <div className="dash-skeleton" style={{ height: 86 }} />
      <div className="dash-skeleton" style={{ height: 12, width: "70%" }} />
    </div>
  );
}

function WidgetEmpty() {
  return (
    <div style={{ minHeight: 140, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: T.faint, fontSize: 13 }}>
      No projects yet. Create a project or upload a repository to begin.
    </div>
  );
}

function WidgetError() {
  return (
    <div style={{ minHeight: 130, display: "grid", placeItems: "center", gap: 10, color: T.faint, textAlign: "center" }}>
      <div>
        <div style={{ color: T.text, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Unable to load dashboard.</div>
        <div style={{ fontSize: 12 }}>Check the workspace connection and try again.</div>
      </div>
      <DashButton><Icons.git />Retry</DashButton>
    </div>
  );
}

function MetricCard({ label, value, trend, color }) {
  return (
    <div className="dash-card" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 16, minHeight: 112 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: T.faint }}>{label}</span>
        <Pill color={color}>{trend}</Pill>
      </div>
      <div style={{ fontFamily: T.mono, fontSize: 26, color: T.text, letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}

export { DashButton, Pill, ProgressBar, WidgetShell, MetricCard };
