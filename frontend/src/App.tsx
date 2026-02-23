import { useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  SelectKubeconfig,
  MergeIntoDefault,
  ListWSLDistros,
  ResolveTargetKubeconfig,
  GetAllContextsForPath,
  GetCurrentContextForPath,
  SwitchContextForPath,
} from "../wailsjs/go/main/App";

type MergeResult = {
  targetConfigPath: string;
  backupPath: string;
  addedClusters: string[];
  addedContexts: string[];
  addedUsers: string[];
  allContexts: string[];
  message: string;
};

type TargetKind = "windows" | "wsl";

export default function App() {
  const [filePath, setFilePath] = useState<string>("");
  const [result, setResult] = useState<MergeResult | null>(null);
  const [status, setStatus] = useState<string>("Ready.");
  const [busy, setBusy] = useState<boolean>(false);

  const [currentContext, setCurrentContext] = useState<string>("");
  const [selectedContext, setSelectedContext] = useState<string>("");
  const [allContexts, setAllContexts] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [targetKind, setTargetKind] = useState<TargetKind>("windows");
  const [wslDistro, setWslDistro] = useState<string>("Ubuntu-24.04");
  const [linuxUser, setLinuxUser] = useState<string>("vj");
  const [targetPath, setTargetPath] = useState<string>("");
  const [wslDistros, setWslDistros] = useState<string[]>([]);
  const [contextFilter, setContextFilter] = useState<string>("");

  const canMerge = useMemo(() => filePath.length > 0 && !busy, [filePath, busy]);

  async function loadFromTarget(kind: TargetKind, distro: string, user: string) {
    try {
      const path = await ResolveTargetKubeconfig({
      kind,
      distro: distro.trim(),
      linuxUser: user.trim(),
}     as any);

      setTargetPath(path);

      const contexts = (await GetAllContextsForPath(path)) as string[];
      setAllContexts(contexts);

      const current = (await GetCurrentContextForPath(path)) as string;
      setCurrentContext(current);
      setSelectedContext(current);

      setStatus(`Loaded target: ${kind.toUpperCase()} (${path})`);
    } catch (e: any) {
      setStatus(`Target load failed: ${e?.message ?? String(e)}`);
    }
  }

  // Startup: load WSL distro list (on Windows) and load default target
  useEffect(() => {
    async function init() {
      // Try list WSL distros; on non-windows builds this returns an error
//      try {
//        const distros = (await ListWSLDistros()) as string[];
//        if (Array.isArray(distros) && distros.length > 0) {
//          setWslDistros(distros);
//          // Keep your default if it exists; otherwise pick first
//          if (!distros.includes(wslDistro)) {
//            setWslDistro(distros[0]);
//          }
//        }
//      } catch {
//        // ignore
//      }
//
      // Load contexts immediately from the selected target
      await loadFromTarget(targetKind, wslDistro, linuxUser);
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runMerge() {
    if (!filePath) return;
    setBusy(true);
    setStatus("Merging...");
    setResult(null);

    try {
      const res = (await MergeIntoDefault(filePath)) as any;
      setResult(res);
      setStatus(res.message);

      // After merge, reload the currently selected target (Windows or WSL)
      await loadFromTarget(targetKind, wslDistro, linuxUser);
    } catch (e: any) {
      setStatus(`Error: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function doSwitch() {
    if (!selectedContext) return;

    try {
      if (!targetPath) {
        setStatus("Target not loaded. Click Load Target.");
        return;
      }

      await SwitchContextForPath(targetPath, selectedContext);

      const ctx = (await GetCurrentContextForPath(targetPath)) as string;
      setCurrentContext(ctx);
      setSelectedContext(ctx);

      const updated = (await GetAllContextsForPath(targetPath)) as string[];
      setAllContexts(updated);

      setStatus(`Switched to: ${ctx}`);
    } catch (e: any) {
      setStatus(`Error switching context: ${e?.message ?? String(e)}`);
    }
  }
  const filteredContexts = useMemo(() => {
  const q = contextFilter.trim().toLowerCase();
  if (!q) return allContexts;
  return allContexts.filter((c) => c.toLowerCase().includes(q));
}, [allContexts, contextFilter]);

  return (
    <div className="container">
      <div className="topbar">
        <div>
          <h1>KubeMerge GUI</h1>
          <p className="subtitle">
            Merge kubeconfigs safely + switch contexts (Windows / WSL) like{" "}
            <code>kubectx</code>
          </p>
        </div>
        <div className="badge">
          Current: <code>{currentContext || "(unknown)"}</code>
        </div>
      </div>

      <div className="statusbar">{status}</div>

      <div className="grid">
        {/* LEFT: Merge */}
        <div className="card">
          <h2>Merge kubeconfig</h2>

          <div className="label">Selected file</div>
          <div className="pathbox">{filePath || "No file selected"}</div>

          <div className="row" style={{ marginTop: "12px" }}>
            <button
              className="btnGhost"
              onClick={async () => {
                const path = await SelectKubeconfig();
                if (path) {
                  setFilePath(path);
                  setStatus(`Selected: ${path}`);
                }
              }}
            >
              Select kubeconfig
            </button>

            <button className="btnPrimary" disabled={!canMerge} onClick={runMerge}>
              {busy ? "Merging..." : "Merge into default kubeconfig"}
            </button>
          </div>

          {result && (
            <>
              <div className="sectionTitle">Last merge result</div>

              <div className="label">Target</div>
              <div className="pathbox">{result.targetConfigPath}</div>

              <div className="label" style={{ marginTop: "10px" }}>
                Backup
              </div>
              <div className="pathbox">{result.backupPath || "(none)"}</div>

              <div className="sectionTitle">Added</div>
              <ul className="list">
                <li>
                  <b>Clusters:</b> {result.addedClusters.join(", ") || "(none)"}
                </li>
                <li>
                  <b>Contexts:</b> {result.addedContexts.join(", ") || "(none)"}
                </li>
                <li>
                  <b>Users:</b> {result.addedUsers.join(", ") || "(none)"}
                </li>
              </ul>
            </>
          )}
        </div>

        {/* RIGHT: Target + Context */}
        <div className="card">
          <h2>Target & Context</h2>

          <div className="label">Target</div>
          <div className="row" style={{ marginBottom: "10px" }}>
            <label style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <input
                type="radio"
                checked={targetKind === "windows"}
                onChange={() => setTargetKind("windows")}
              />
              Windows
            </label>

            <label style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <input
                type="radio"
                checked={targetKind === "wsl"}
                onChange={() => setTargetKind("wsl")}
              />
              WSL
            </label>
          </div>

          {targetKind === "wsl" && (
            <>
              <div className="label">WSL distro</div>
              <div className="row" style={{ marginBottom: "10px" }}>
                <select value={wslDistro} onChange={(e) => setWslDistro(e.target.value)}>
                  {/* Prefer discovered distros; fallback to default */}
                  {["Ubuntu-24.04"].map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="label">Linux username (inside WSL)</div>
              <div className="row" style={{ marginBottom: "10px" }}>
                <input
                  style={{
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.92)",
                    borderRadius: "12px",
                    padding: "10px 12px",
                  }}
                  value={linuxUser}
                  onChange={(e) => setLinuxUser(e.target.value)}
                  placeholder="e.g. vj"
                />
              </div>
            </>
          )}

          <div className="row" style={{ marginBottom: "10px" }}>
            <button
              className="btnGhost"
              onClick={async () => {
                await loadFromTarget(targetKind, wslDistro, linuxUser);
              }}
            >
              Load Target
            </button>
          </div>

          <div className="label">Resolved kubeconfig path</div>
          <div className="pathbox">{targetPath || "(not loaded yet)"}</div>
          <div className="sectionTitle">Search</div>
          <input
            style={{
              width: "100%",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.92)",
              borderRadius: "12px",
              padding: "10px 12px",
              marginBottom: "10px",
            }}
            value={contextFilter}
            onChange={(e) => setContextFilter(e.target.value)}
            placeholder="Type to filter contexts (e.g., aks, prod, dev...)"
          />

          <div className="sectionTitle">Switch context</div>
          <div className="row">
            <div className="dropdown">
              <div
                className="dropdownSelected"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                {selectedContext || "Select context"}
              </div>
                        
              {dropdownOpen && (
                <div className="dropdownMenu">
                  {filteredContexts.map((c) => (
                    <div
                      key={c}
                      className={`dropdownItem ${c === currentContext ? "active" : ""}`}
                      onClick={() => {
                        setSelectedContext(c);
                        setDropdownOpen(false);
                      }}
                    >
                      {c}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              className="btnPrimary"
              disabled={!selectedContext || selectedContext === currentContext}
              onClick={doSwitch}
            >
              Switch
            </button>
          </div>

          <div className="sectionTitle">Contexts</div>
          <ul className="list">
            {filteredContexts.slice(0, 12).map((c) => (
              <li key={c}>
                {c === currentContext ? (
                  <b>
                    <code>{c}</code>
                  </b>
                ) : (
                  <code>{c}</code>
                )}
              </li>
            ))}
            {filteredContexts.length > 12 && <li>…and {filteredContexts.length - 12} more</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}