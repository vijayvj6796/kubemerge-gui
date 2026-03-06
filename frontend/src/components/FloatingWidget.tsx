import { useEffect, useState, useCallback } from "react";
import {
  GetAllContextsForPath,
  GetCurrentContextForPath,
  SwitchContextForPath,
  GetCurrentNamespaceForPath,
  ListNamespacesForPath,
  SetNamespaceForPath,
  GetTargetKubeconfig,
  WidgetCollapse,
  WidgetExpand,
} from "../../wailsjs/go/main/App";

const FEATURE_FLAGS = { floatingWidget: true } as const;
type Tab = "context" | "namespace";

function K8sIcon({ size = 20, spin = false }: { size?: number; spin?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none"
      style={spin ? { animation: "kw-spin 1.3s linear infinite" } : undefined}>
      <circle cx="16" cy="16" r="14" fill="rgba(99,102,241,0.18)" stroke="#6366f1" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="3.5" fill="#6366f1" />
      {[0,45,90,135,180,225,270,315].map((deg, i) => {
        const r = (deg * Math.PI) / 180;
        return <line key={i}
          x1={16+Math.cos(r)*4.8} y1={16+Math.sin(r)*4.8}
          x2={16+Math.cos(r)*10}  y2={16+Math.sin(r)*10}
          stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" />;
      })}
      {[0,45,90,135,180,225,270,315].map((deg, i) => {
        const r = (deg * Math.PI) / 180;
        return <circle key={i}
          cx={16+Math.cos(r)*11} cy={16+Math.sin(r)*11}
          r="1.9" fill="#6366f1" />;
      })}
    </svg>
  );
}

export default function FloatingWidget() {
  if (!FEATURE_FLAGS.floatingWidget) return null;
  return <FloatingWidgetInner />;
}

function FloatingWidgetInner() {
  const [expanded, setExpanded]   = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("context");

  const [targetPath, setTargetPath]           = useState("");
  const [currentContext, setCurrentContext]   = useState("");
  const [allContexts, setAllContexts]         = useState<string[]>([]);
  const [contextSearch, setContextSearch]     = useState("");
  const [switching, setSwitching]             = useState(false);
  const [currentNs, setCurrentNs]             = useState("default");
  const [allNamespaces, setAllNamespaces]     = useState<string[]>([]);
  const [nsSearch, setNsSearch]               = useState("");
  const [loadingNs, setLoadingNs]             = useState(false);
  const [status, setStatus]                   = useState("…");
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState("");

  // ── Bootstrap ──────────────────────────────────────────────────────
  // GetTargetKubeconfig() returns a plain string (no error) in Go.
  // We retry with delays to avoid a race condition where App.tsx has not
  // called SetTargetKubeconfig yet. Critical for WSL — without this the
  // widget falls back to ~/.kube/config instead of the WSL path.
  useEffect(() => {
    async function init() {
      for (let attempt = 0; attempt < 15; attempt++) {
        try {
          const path: string = await (GetTargetKubeconfig as () => Promise<string>)();
          if (path) {
            const [ctxs, cur] = await Promise.all([
              GetAllContextsForPath(path) as Promise<string[]>,
              GetCurrentContextForPath(path) as Promise<string>,
            ]);
            if (ctxs && ctxs.length > 0) {
              setTargetPath(path);
              setAllContexts(ctxs);
              setCurrentContext(cur);
              try {
                setCurrentNs((await GetCurrentNamespaceForPath(path, cur) as string) || "default");
              } catch { setCurrentNs("default"); }
              setStatus(`${ctxs.length} ctx`);
              setLoading(false);
              return;
            }
          }
        } catch { /* not ready yet */ }
        await new Promise(r => setTimeout(r, 400));
      }
      setError("Could not load kubeconfig — load target in main app first");
      setLoading(false);
    }
    init();
  }, []);

  // ── Load namespaces ────────────────────────────────────────────────
  const loadNamespaces = useCallback(async () => {
    if (!targetPath || !currentContext) return;
    setLoadingNs(true);
    try {
      const ns  = await ListNamespacesForPath(targetPath, currentContext) as string[];
      const cur = await GetCurrentNamespaceForPath(targetPath, currentContext) as string;
      setAllNamespaces(ns);
      setCurrentNs(cur || "default");
    } catch {} finally { setLoadingNs(false); }
  }, [targetPath, currentContext]);

  useEffect(() => {
    if (activeTab === "namespace" && expanded && allNamespaces.length === 0 && targetPath)
      loadNamespaces();
  }, [activeTab, expanded, loadNamespaces]);

  // ── Expand / collapse — resizes the actual OS window ──────────────
  async function doExpand() {
    setExpanded(true);
    try { await WidgetExpand(); } catch {}
  }
  async function doCollapse() {
    setExpanded(false);
    setContextSearch(""); setNsSearch("");
    try { await WidgetCollapse(); } catch {}
  }

  // ── Context switch ─────────────────────────────────────────────────
  async function switchCtx(ctx: string) {
    if (!targetPath || ctx === currentContext || switching) return;
    setSwitching(true);
    try {
      await SwitchContextForPath(targetPath, ctx);
      setCurrentContext(ctx);
      const updated = await GetAllContextsForPath(targetPath) as string[];
      setAllContexts(updated);
      setAllNamespaces([]);
      try {
        setCurrentNs((await GetCurrentNamespaceForPath(targetPath, ctx) as string) || "default");
      } catch { setCurrentNs("default"); }
      setContextSearch("");
      setStatus(`${updated.length} ctx`);
    } catch {} finally { setSwitching(false); }
  }

  // ── Namespace switch ───────────────────────────────────────────────
  async function switchNs(ns: string) {
    if (!targetPath || !currentContext || ns === currentNs) return;
    try {
      await SetNamespaceForPath(targetPath, currentContext, ns);
      setCurrentNs(ns); setNsSearch("");
    } catch {}
  }

  // ── Key handler: never block Alt (Alt+Tab), stop app shortcuts ─────
  function onKey(e: React.KeyboardEvent) {
    if (e.altKey) return;
    e.stopPropagation();
    if (e.key === "Escape") doCollapse();
  }

  const filteredCtx = contextSearch.trim()
    ? allContexts.filter(c => c.toLowerCase().includes(contextSearch.toLowerCase()))
    : allContexts;
  const filteredNs = nsSearch.trim()
    ? allNamespaces.filter(n => n.toLowerCase().includes(nsSearch.toLowerCase()))
    : allNamespaces;

  const shortCtx = currentContext.length > 26
    ? currentContext.slice(0,13) + "…" + currentContext.slice(-8)
    : currentContext;

  // ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      width: "100vw", height: "100vh",
      background: "transparent",
      overflow: "hidden",
      fontFamily: "'JetBrains Mono','Fira Code',monospace",
    }}>
      <style>{`
        @keyframes kw-spin  { to { transform: rotate(360deg); } }
        @keyframes kw-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(99,102,241,.5)} 50%{box-shadow:0 0 0 8px rgba(99,102,241,0)} }
        @keyframes kw-pop   { from{opacity:0;transform:scale(.88)} to{opacity:1;transform:scale(1)} }
        * { box-sizing: border-box; }
        .kw-fab:hover  { transform: scale(1.1) !important; }
        .kw-fab:active { transform: scale(0.93) !important; }
        .kw-rg:hover   { background: rgba(34,197,94,0.1)   !important; }
        .kw-ri:hover   { background: rgba(99,102,241,0.1)  !important; }
        .kw-tab:hover  { color: #c7d2fe !important; }
        .kw-sc::-webkit-scrollbar       { width: 3px; }
        .kw-sc::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 99px; }
        input:focus { border-color: rgba(99,102,241,0.5) !important; outline: none; }
      `}</style>

      {/*
        ── FAB BUTTON ────────────────────────────────────────────────
        The  style prop includes  --wails-draggable: drag
        This is the magic Wails CSS property that makes the OS window
        draggable by this element on frameless windows.
        Users drag the icon → the whole OS window moves.
        Clicking (without drag) toggles the panel open/closed.
      */}
      <button
        className="kw-fab"
        onClick={() => expanded ? doCollapse() : doExpand()}
        title={expanded ? "Click to collapse · Drag to move" : `Active: ${currentContext || "loading…"} · Drag to move`}
        style={{
          // ↓ This is what enables OS-level window dragging on frameless windows
          "--wails-draggable": "drag",
          position: "absolute",
          left: 4, top: 4,
          width: 44, height: 44,
          borderRadius: "50%",
          background: expanded
            ? "rgba(99,102,241,0.88)"
            : error ? "rgba(220,38,38,0.82)"
            : "rgba(10,14,26,0.94)",
          border: `1.5px solid ${
            expanded ? "rgba(165,180,252,0.6)"
            : error   ? "rgba(252,165,165,0.4)"
            : "rgba(99,102,241,0.55)"
          }`,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          boxShadow: expanded
            ? "0 4px 24px rgba(99,102,241,0.45)"
            : "0 4px 20px rgba(0,0,0,0.65), 0 0 0 1px rgba(99,102,241,0.12)",
          cursor: "grab",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 0, outline: "none",
          userSelect: "none", zIndex: 10,
          transition: "transform .13s, background .18s, box-shadow .18s",
          animation: loading ? "kw-pulse 2s infinite" : "none",
        } as React.CSSProperties}
      >
        {error
          ? <span style={{ fontSize:18, color:"#fca5a5", pointerEvents:"none" }}>⚠</span>
          : <div style={{ pointerEvents: "none" }}>
              <K8sIcon size={22} spin={loading} />
            </div>
        }
      </button>

      {/* ── Expanded panel ──────────────────────────────────────────── */}
      {expanded && (
        <div style={{
          position: "absolute",
          left: 4, top: 54,
          width: 308,
          background: "rgba(9,13,26,0.97)",
          border: "1px solid rgba(99,102,241,0.32)",
          borderRadius: 14,
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(99,102,241,0.08)",
          overflow: "hidden",
          animation: "kw-pop 0.17s ease-out",
        }}>

          {/* Header — also draggable so user can drag by the panel header */}
          <div
            style={{
              "--wails-draggable": "drag",
              padding: "11px 14px 9px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              cursor: "grab",
            } as React.CSSProperties}
          >
            <div style={{ display:"flex", alignItems:"center", gap:7, pointerEvents:"none" }}>
              <K8sIcon size={15} />
              <span style={{ fontSize:11, fontWeight:700, color:"#e2e8f0", letterSpacing:"0.05em" }}>
                KubeMerge
              </span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:7, pointerEvents:"none" }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:"#22c55e",
                boxShadow:"0 0 5px #22c55e", display:"inline-block" }} />
              <span style={{ fontSize:10, color:"#64748b", maxWidth:155,
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}
                title={currentContext}>
                {shortCtx || "—"}
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display:"flex", borderBottom:"1px solid rgba(255,255,255,0.06)",
            background:"rgba(255,255,255,0.02)" }}>
            {(["context","namespace"] as Tab[]).map(t => (
              <button key={t} className="kw-tab" onClick={() => setActiveTab(t)} style={{
                flex:1, padding:"8px 0", background:"transparent", border:"none",
                borderBottom: activeTab===t ? "2px solid #6366f1" : "2px solid transparent",
                color: activeTab===t ? "#a5b4fc" : "rgba(100,116,139,0.6)",
                fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase",
                cursor:"pointer", fontFamily:"inherit", transition:"color .14s",
              }}>
                {t === "context" ? "⚡ Context" : "📦 Namespace"}
              </button>
            ))}
          </div>

          {/* ── Context tab ──────────────────────────────────────── */}
          {activeTab === "context" && (<>
            <div style={{ padding:"9px 10px 4px" }}>
              <div style={{ position:"relative" }}>
                <span style={{ position:"absolute", left:9, top:"50%",
                  transform:"translateY(-50%)", fontSize:12,
                  color:"rgba(100,116,139,0.5)", pointerEvents:"none" }}>⌕</span>
                <input autoFocus placeholder="search contexts…"
                  value={contextSearch} onChange={e => setContextSearch(e.target.value)}
                  onKeyDown={onKey}
                  style={{ ...iSt, paddingLeft:26 }} />
              </div>
            </div>
            <div style={{ padding:"3px 12px 7px" }}>
              <span style={lSt}>active</span>
              <span style={{ ...cSt, color:"#4ade80", background:"rgba(34,197,94,0.1)",
                border:"1px solid rgba(34,197,94,0.2)" }}>
                {shortCtx || "—"}
              </span>
            </div>
            <div className="kw-sc" style={{ maxHeight:220, overflowY:"auto", padding:"0 6px 6px" }}>
              {filteredCtx.length === 0 && <div style={eSt}>no results</div>}
              {filteredCtx.map(ctx => {
                const on = ctx === currentContext;
                return (
                  <button key={ctx} disabled={switching} onClick={() => switchCtx(ctx)}
                    className={on ? undefined : "kw-rg"}
                    style={{ ...rSt,
                      background: on ? "rgba(34,197,94,0.1)" : "transparent",
                      border: `1px solid ${on ? "rgba(34,197,94,0.2)" : "transparent"}`,
                      cursor: on ? "default" : "pointer",
                    }}>
                    <span style={{ ...dSt,
                      background: on ? "#22c55e" : "rgba(100,116,139,0.22)",
                      boxShadow: on ? "0 0 5px #22c55e70" : "none" }} />
                    <span style={{ flex:1, textAlign:"left", fontSize:11,
                      fontWeight: on ? 600 : 400,
                      color: on ? "#86efac" : "rgba(203,213,225,0.75)",
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {ctx}
                    </span>
                    {!on && <span style={aSt}>→</span>}
                    {on  && <span style={{ fontSize:10, color:"#22c55e", flexShrink:0 }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </>)}

          {/* ── Namespace tab ─────────────────────────────────────── */}
          {activeTab === "namespace" && (<>
            <div style={{ padding:"9px 10px 4px", display:"flex", gap:6 }}>
              <div style={{ position:"relative", flex:1 }}>
                <span style={{ position:"absolute", left:9, top:"50%",
                  transform:"translateY(-50%)", fontSize:12,
                  color:"rgba(100,116,139,0.5)", pointerEvents:"none" }}>⌕</span>
                <input autoFocus placeholder="search namespaces…"
                  value={nsSearch} onChange={e => setNsSearch(e.target.value)}
                  onKeyDown={onKey}
                  style={{ ...iSt, paddingLeft:26 }} />
              </div>
              <button onClick={loadNamespaces} disabled={loadingNs} title="Refresh"
                style={{ padding:"0 10px", background:"rgba(99,102,241,0.1)",
                  border:"1px solid rgba(99,102,241,0.22)", borderRadius:8,
                  color:"#818cf8", fontSize:15, cursor:"pointer",
                  fontFamily:"inherit", flexShrink:0 }}>
                <span style={{ display:"inline-block",
                  animation: loadingNs ? "kw-spin 0.8s linear infinite" : "none" }}>↻</span>
              </button>
            </div>
            <div style={{ padding:"3px 12px 7px" }}>
              <span style={lSt}>active</span>
              <span style={{ ...cSt, color:"#a5b4fc", background:"rgba(99,102,241,0.1)",
                border:"1px solid rgba(99,102,241,0.22)" }}>
                {currentNs}
              </span>
            </div>
            <div className="kw-sc" style={{ maxHeight:220, overflowY:"auto", padding:"0 6px 6px" }}>
              {loadingNs && <div style={eSt}>
                <span style={{ display:"inline-block", animation:"kw-spin .8s linear infinite", marginRight:6 }}>↻</span>
                loading…
              </div>}
              {!loadingNs && filteredNs.length === 0 &&
                <div style={eSt}>{allNamespaces.length === 0 ? "click ↻ to load" : "no results"}</div>}
              {!loadingNs && filteredNs.map(ns => {
                const on = ns === currentNs;
                return (
                  <button key={ns} onClick={() => switchNs(ns)}
                    className={on ? undefined : "kw-ri"}
                    style={{ ...rSt,
                      background: on ? "rgba(99,102,241,0.1)" : "transparent",
                      border: `1px solid ${on ? "rgba(99,102,241,0.22)" : "transparent"}`,
                      cursor: on ? "default" : "pointer",
                    }}>
                    <span style={{ ...dSt,
                      background: on ? "#6366f1" : "rgba(100,116,139,0.22)",
                      boxShadow: on ? "0 0 5px #6366f170" : "none" }} />
                    <span style={{ flex:1, textAlign:"left", fontSize:11,
                      fontWeight: on ? 600 : 400,
                      color: on ? "#a5b4fc" : "rgba(203,213,225,0.75)" }}>
                      {ns}
                    </span>
                    {!on && <span style={aSt}>→</span>}
                    {on  && <span style={{ fontSize:10, color:"#6366f1", flexShrink:0 }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </>)}

          {/* Footer */}
          <div style={{ padding:"6px 12px", borderTop:"1px solid rgba(255,255,255,0.045)",
            display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:9, color:"rgba(71,85,105,0.6)" }}>
              {status} · drag icon or header to move
            </span>
            <button onClick={doCollapse} style={{ background:"none", border:"none",
              color:"rgba(100,116,139,0.45)", fontSize:10, cursor:"pointer",
              fontFamily:"inherit", padding:"0 2px" }}>
              ✕ close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared micro-styles ──────────────────────────────────────────────────────
const iSt: React.CSSProperties = {
  width:"100%", padding:"7px 10px",
  background:"rgba(255,255,255,0.045)",
  border:"1px solid rgba(99,102,241,0.2)",
  borderRadius:8, color:"rgba(226,232,240,0.9)",
  fontSize:11, outline:"none",
  fontFamily:"'JetBrains Mono','Fira Code',monospace",
  boxSizing:"border-box", transition:"border-color .15s",
};
const rSt: React.CSSProperties = {
  display:"flex", alignItems:"center", gap:8,
  width:"100%", padding:"7px 8px",
  borderRadius:8, marginBottom:2,
  fontFamily:"inherit", transition:"background .1s, border-color .1s",
};
const dSt: React.CSSProperties = {
  width:6, height:6, borderRadius:"50%", flexShrink:0,
};
const aSt: React.CSSProperties = {
  fontSize:9, color:"rgba(99,102,241,0.45)", flexShrink:0,
};
const lSt: React.CSSProperties = {
  fontSize:9, color:"rgba(100,116,139,0.55)",
  textTransform:"uppercase", letterSpacing:"0.08em", marginRight:6,
};
const cSt: React.CSSProperties = {
  fontSize:10, fontWeight:600, padding:"1px 7px", borderRadius:20,
};
const eSt: React.CSSProperties = {
  padding:"18px 12px", textAlign:"center",
  fontSize:10, color:"rgba(71,85,105,0.65)", fontStyle:"italic",
};
