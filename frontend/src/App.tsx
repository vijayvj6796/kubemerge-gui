import { useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  SelectKubeconfig,
  MergeIntoDefault,
  MergeIntoTarget,
  ListWSLDistros,
  ResolveTargetKubeconfig,
  GetAllContextsForPath,
  GetCurrentContextForPath,
  SwitchContextForPath,
  GetDefaultWSLUser,
  TestFileExists,
  GetOS,
  DeleteContextForPath,
} from "../wailsjs/go/main/App";
import ContextDropdown from "./components/ContextDropdown";

type MergeResult = {
  targetConfigPath: string;
  backupPath: string;
  addedClusters: string[];
  addedContexts: string[];
  addedUsers: string[];
  allContexts: string[];
  message: string;
};

type TargetKind = "windows" | "wsl" | "linux";

export default function App() {
  const [filePath, setFilePath] = useState<string>("");
  const [result, setResult] = useState<MergeResult | null>(null);
  const [status, setStatus] = useState<string>("Ready.");
  const [busy, setBusy] = useState<boolean>(false);

  const [currentContext, setCurrentContext] = useState<string>("");
  const [selectedContext, setSelectedContext] = useState<string>("");
  const [allContexts, setAllContexts] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [os, setOs] = useState<string>("");
  const [targetKind, setTargetKind] = useState<TargetKind>("linux");
  const [wslDistro, setWslDistro] = useState<string>("");
  const [linuxUser, setLinuxUser] = useState<string>("");
  const [targetPath, setTargetPath] = useState<string>("");
  const [wslDistros, setWslDistros] = useState<string[]>([]);
  // Remove contextFilter, use only searchTerm for dropdown search
  const [searchTerm, setSearchTerm] = useState("");

  const canMerge = useMemo(() => filePath.length > 0 && !busy, [filePath, busy]);

  // Detect OS on mount
  useEffect(() => {
    async function detectOS() {
      try {
        const detectedOS = await GetOS();
        setOs(detectedOS);
        // Auto-select appropriate default target
        if (detectedOS === "windows") {
          setTargetKind("windows");
          setStatus(`Running on Windows. Select target: Windows or WSL.`);
        } else {
          setTargetKind("linux");
          setStatus(`Running on ${detectedOS}. Using native Linux kubeconfig.`);
        }
      } catch (e: any) {
        setStatus(`Failed to detect OS: ${e?.message ?? String(e)}`);
      }
    }
    detectOS();
  }, []);

  async function loadFromTarget(kind: TargetKind, distro: string, user: string) {
    try {
      // Log what we're trying to load
      console.log(`Loading target: kind=${kind}, distro=${distro}, user=${user}`);
      
      // Validate inputs for WSL
      if (kind === "wsl") {
        if (!distro.trim()) {
          setStatus("Error: WSL distro is required");
          return;
        }
        if (!user.trim()) {
          setStatus("Error: Linux username is required");
          return;
        }
      }

      const path = await ResolveTargetKubeconfig({
        kind,
        distro: distro.trim(),
        linuxUser: user.trim(),
      } as any);

      console.log(`Resolved path: ${path}`);
      setTargetPath(path);
      setStatus(`Resolved path: ${path}. Checking if file exists...`);

      const ok = await TestFileExists(path);
      if (!ok) {
        setStatus(`Target load failed: kubeconfig not found at ${path}`);
        return;
      }

      const contexts = (await GetAllContextsForPath(path)) as string[];
      setAllContexts(contexts);

      const current = (await GetCurrentContextForPath(path)) as string;
      setCurrentContext(current);
      setSelectedContext(current);

      setStatus(`Loaded target: ${kind.toUpperCase()} (${contexts.length} contexts found)`);
    } catch (e: any) {
      setStatus(`Target load failed: ${e?.message ?? String(e)}`);
    }
  }

  // On mount or when WSL is selected, load WSL distros and auto-select first
  useEffect(() => {
    async function loadWSLDistros() {
      if (targetKind !== "wsl") return;
      try {
        const distros = await ListWSLDistros();
        if (Array.isArray(distros) && distros.length > 0) {
          setWslDistros(distros);
          setWslDistro((prev) => prev || distros[0]);
        } else {
          setWslDistros(["Ubuntu"]);
          setWslDistro((prev) => prev || "Ubuntu");
        }
      } catch {
        setWslDistros(["Ubuntu"]);
        setWslDistro((prev) => prev || "Ubuntu");
      }
    }
    loadWSLDistros();
  }, [targetKind]);

  // When WSL distro changes, auto-detect default user
  useEffect(() => {
    async function autoUser() {
      if (targetKind !== "wsl" || !wslDistro) return;
      try {
        const u = await GetDefaultWSLUser(wslDistro);
        if (u && typeof u === "string") {
          setLinuxUser(u);
          setStatus(`Auto-detected username for ${wslDistro}: ${u}`);
        }
      } catch (e: any) {
        setStatus(`Could not auto-detect username for ${wslDistro}. Please enter manually.`);
      }
    }
    autoUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKind, wslDistro]);

  async function runMerge() {
    if (!filePath || !targetPath) return;
    setBusy(true);
    setStatus("Merging...");
    setResult(null);

    try {
      const res = (await MergeIntoTarget(targetPath, filePath)) as any;
      setResult(res);
      setStatus(res.message);

      // After merge, reload the currently selected target (Windows, WSL, or Linux)
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
  // Filtered contexts for dropdown, using searchTerm
  const filteredContexts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return allContexts;
    return allContexts.filter((c) => c.toLowerCase().includes(q));
  }, [allContexts, searchTerm]);

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
            {os === "windows" ? (
              <>
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
              </>
            ) : (
              <label style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <input
                  type="radio"
                  checked={targetKind === "linux"}
                  onChange={() => setTargetKind("linux")}
                />
                Linux (~/.kube/config)
              </label>
            )}
          </div>

          {targetKind === "wsl" && (
            <>
              <div className="label">WSL distro</div>
              <div className="row" style={{ marginBottom: "10px" }}>
                <select
                  value={wslDistro}
                  onChange={(e) => {
                    setWslDistro(e.target.value);
                  }}
                >
                  {wslDistros.map((d) => (
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

              {wslDistro && linuxUser && (
                <div style={{ 
                  fontSize: "11px", 
                  color: "rgba(255,255,255,0.6)", 
                  marginBottom: "10px",
                  fontFamily: "monospace"
                }}>
                  Will use: \\wsl$\{wslDistro}\home\{linuxUser}\.kube\config
                </div>
              )}
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
                    {/* 🔍 Search inside dropdown */}
                    <div className="dropdownSearch">
                      <input
                        type="text"
                        placeholder="Search contexts..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                      />
                    </div>
                    {filteredContexts.length === 0 && (
                      <div className="dropdownItem">No contexts found</div>
                    )}
                    {filteredContexts.map((c) => (
                      <div
                        key={c}
                        className={`dropdownItem ${c === currentContext ? "active" : ""}`}
                        onClick={() => {
                          setSelectedContext(c);
                          setDropdownOpen(false);
                          setSearchTerm("");
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
            {allContexts.slice(0, 12).map((c) => (
              <li key={c} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {c === currentContext ? (
                  <b>
                    <code>{c}</code>
                  </b>
                ) : (
                  <code>{c}</code>
                )}
                <button
                  className="btnDanger"
                  style={{ marginLeft: 8, fontSize: 12, padding: "2px 8px" }}
                  title={`Delete context '${c}'`}
                  onClick={async () => {
                    if (!window.confirm(`Delete context '${c}'? This cannot be undone.`)) return;
                    setStatus(`Deleting context '${c}'...`);
                    try {
                      await DeleteContextForPath(targetPath, c);
                      setAllContexts((prev) => prev.filter((ctx) => ctx !== c));
                      setStatus(`Deleted context '${c}'.`);
                      if (currentContext === c) {
                        setCurrentContext("");
                        setSelectedContext("");
                      }
                    } catch (e: any) {
                      setStatus(`Failed to delete context '${c}': ${e?.message ?? String(e)}`);
                    }
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
            {allContexts.length > 12 && <li>…and {allContexts.length - 12} more</li>}
          </ul>
        </div>
      </div>
      <footer style={{ textAlign: "center", padding: "20px", color: "#888", fontSize: "14px" }}>
        Made with ❤️ by Cipheronic
      </footer>
    </div>
  );
}