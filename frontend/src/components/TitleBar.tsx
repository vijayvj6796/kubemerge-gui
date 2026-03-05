// TitleBar.tsx
// Custom title bar for frameless window mode.
// Uses --wails-draggable so users can drag the full GUI window by its title bar.

import { WindowMinimise, WindowToggleMaximise } from "../../wailsjs/runtime/runtime";

export default function TitleBar() {
  return (
    <div
      style={{
        // This CSS property tells Wails: dragging here moves the OS window
        "--wails-draggable": "drag",
        height: 36,
        background: "rgba(8, 12, 24, 0.98)",
        borderBottom: "1px solid rgba(99,102,241,0.2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px 0 14px",
        cursor: "grab",
        flexShrink: 0,
        userSelect: "none",
      } as React.CSSProperties}
    >
      {/* App name */}
      <div style={{ display:"flex", alignItems:"center", gap:8, pointerEvents:"none" }}>
        <span style={{ fontSize:16 }}>⚡</span>
        <span style={{
          fontSize: 12, fontWeight: 700,
          color: "#e2e8f0", letterSpacing: "0.04em",
          fontFamily: "'JetBrains Mono','Fira Code',monospace",
        }}>
          KubeMerge GUI
        </span>
      </div>

      {/* Window controls — these must NOT be draggable */}
      <div style={{
        display: "flex", gap: 6,
        // Stop drag from activating on the buttons
        "--wails-draggable": "no-drag",
        cursor: "default",
      } as React.CSSProperties}>
        <button onClick={WindowMinimise} style={btnSt} title="Minimise">─</button>
        <button onClick={WindowToggleMaximise} style={btnSt} title="Maximise">□</button>
      </div>
    </div>
  );
}

const btnSt: React.CSSProperties = {
  width: 26, height: 22,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 5,
  color: "rgba(148,163,184,0.8)",
  fontSize: 11,
  cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: 0,
  transition: "background .15s",
  fontFamily: "inherit",
};
