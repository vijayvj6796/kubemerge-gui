import { useEffect, useMemo, useState, useRef } from "react";
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
  TestClusterConnectivity,
  GetClusterInfoForCurrentContext,
  GetCurrentNamespaceForPath,
  ListNamespacesForPath,
  SetNamespaceForPath,
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

type ClusterInfo = {
  reachable: boolean;
  version: string;
  authenticated: boolean;
  clusterName: string;
  serverUrl: string;
  errorMessage: string;
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
  const [clusterInfo, setClusterInfo] = useState<ClusterInfo | null>(null);
  const [testingCluster, setTestingCluster] = useState<boolean>(false);
  
  // Namespace management
  const [currentNamespace, setCurrentNamespace] = useState<string>("default");
  const [selectedNamespace, setSelectedNamespace] = useState<string>("default");
  const [allNamespaces, setAllNamespaces] = useState<string[]>([]);
  const [namespaceDropdownOpen, setNamespaceDropdownOpen] = useState<boolean>(false);
  const [loadingNamespaces, setLoadingNamespaces] = useState<boolean>(false);
  const [namespaceSearchTerm, setNamespaceSearchTerm] = useState("");
  
  // Refs for keyboard shortcuts
  const searchInputRef = useRef<HTMLInputElement>(null);
  const namespaceSearchInputRef = useRef<HTMLInputElement>(null);

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K - Quick context switcher (open dropdown and focus search)
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setDropdownOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
      
      // Ctrl+N or Cmd+N - Quick namespace switcher
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        if (allNamespaces.length === 0) {
          loadNamespaces();
        }
        setNamespaceDropdownOpen(true);
        setTimeout(() => namespaceSearchInputRef.current?.focus(), 100);
      }
      
      // Ctrl+M or Cmd+M - Quick merge
      if ((e.ctrlKey || e.metaKey) && e.key === "m") {
        e.preventDefault();
        if (canMerge && !busy) {
          runMerge();
        }
      }
      
      // Ctrl+F or Cmd+F - Focus search (when dropdown is open)
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        if (dropdownOpen) {
          searchInputRef.current?.focus();
        } else if (namespaceDropdownOpen) {
          namespaceSearchInputRef.current?.focus();
        } else {
          setDropdownOpen(true);
          setTimeout(() => searchInputRef.current?.focus(), 100);
        }
      }

      // Escape - Close dropdown
      if (e.key === "Escape") {
        if (dropdownOpen) {
          setDropdownOpen(false);
          setSearchTerm("");
        }
        if (namespaceDropdownOpen) {
          setNamespaceDropdownOpen(false);
          setNamespaceSearchTerm("");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canMerge, busy, dropdownOpen, namespaceDropdownOpen, allNamespaces]);

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

      // Load namespace for the current context
      await loadNamespacesForContext(path, current);

      setStatus(`Loaded target: ${kind.toUpperCase()} (${contexts.length} contexts found)`);
    } catch (e: any) {
      setStatus(`Target load failed: ${e?.message ?? String(e)}`);
    }
  }

  // Load namespaces for a specific context
  async function loadNamespacesForContext(path: string, contextName: string) {
    if (!path || !contextName) return;

    try {
      // Get current namespace for the context
      const currentNs = await GetCurrentNamespaceForPath(path, contextName);
      setCurrentNamespace(currentNs);
      setSelectedNamespace(currentNs);
    } catch (e: any) {
      console.error("Failed to load current namespace:", e);
      setCurrentNamespace("default");
      setSelectedNamespace("default");
    }
  }

  // Load all namespaces from the cluster for the current context
  async function loadAllNamespaces() {
    if (!targetPath || !currentContext) {
      setStatus("No target loaded. Please load a target first.");
      return;
    }

    setLoadingNamespaces(true);
    setStatus("Loading namespaces from cluster...");

    try {
      const namespaces = await ListNamespacesForPath(targetPath, currentContext);
      setAllNamespaces(namespaces);
      setStatus(`Loaded ${namespaces.length} namespaces from cluster`);
    } catch (e: any) {
      setStatus(`Failed to load namespaces: ${e?.message ?? String(e)}`);
      setAllNamespaces([]);
    } finally {
      setLoadingNamespaces(false);
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

      // Load namespace for the new context
      await loadNamespacesForContext(targetPath, ctx);

      setStatus(`Switched to: ${ctx}`);
    } catch (e: any) {
      setStatus(`Error switching context: ${e?.message ?? String(e)}`);
    }
  }

  async function testClusterConnection() {
    if (!targetPath || !currentContext) {
      setStatus("No context selected. Load target first.");
      return;
    }

    setTestingCluster(true);
    setStatus("Testing cluster connectivity...");
    setClusterInfo(null);

    try {
      const info = (await TestClusterConnectivity(targetPath, currentContext)) as ClusterInfo;
      setClusterInfo(info);
      if (info.reachable) {
        setStatus(`✓ Cluster reachable! Version: ${info.version}`);
      } else {
        setStatus(`✗ Cluster unreachable: ${info.errorMessage}`);
      }
    } catch (e: any) {
      setStatus(`Cluster test failed: ${e?.message ?? String(e)}`);
      setClusterInfo({
        reachable: false,
        version: "",
        authenticated: false,
        clusterName: currentContext,
        serverUrl: "",
        errorMessage: e?.message ?? String(e),
      });
    } finally {
      setTestingCluster(false);
    }
  }

  async function loadNamespaces() {
    if (!targetPath || !currentContext) {
      setStatus("No context selected. Load target first.");
      return;
    }

    setLoadingNamespaces(true);
    setStatus("Loading namespaces...");

    try {
      const namespaces = (await ListNamespacesForPath(targetPath, currentContext)) as string[];
      setAllNamespaces(namespaces);
      
      const currentNs = (await GetCurrentNamespaceForPath(targetPath, currentContext)) as string;
      setCurrentNamespace(currentNs);
      setSelectedNamespace(currentNs);
      
      setStatus(`Loaded ${namespaces.length} namespaces. Current: ${currentNs}`);
    } catch (e: any) {
      setStatus(`Failed to load namespaces: ${e?.message ?? String(e)}`);
      setAllNamespaces([]);
    } finally {
      setLoadingNamespaces(false);
    }
  }

  async function doSwitchNamespace() {
    if (!selectedNamespace || !currentContext || !targetPath) return;

    try {
      await SetNamespaceForPath(targetPath, currentContext, selectedNamespace);
      setCurrentNamespace(selectedNamespace);
      setStatus(`Switched namespace to: ${selectedNamespace}`);
    } catch (e: any) {
      setStatus(`Error switching namespace: ${e?.message ?? String(e)}`);
    }
  }
  
  // Filtered contexts for dropdown, using searchTerm
  const filteredContexts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return allContexts;
    return allContexts.filter((c) => c.toLowerCase().includes(q));
  }, [allContexts, searchTerm]);

  // Filtered namespaces for dropdown
  const filteredNamespaces = useMemo(() => {
    const q = namespaceSearchTerm.trim().toLowerCase();
    if (!q) return allNamespaces;
    return allNamespaces.filter((ns) => ns.toLowerCase().includes(q));
  }, [allNamespaces, namespaceSearchTerm]);

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
          <div>Context: <code>{currentContext || "(unknown)"}</code></div>
          <div style={{ marginTop: 4 }}>Namespace: <code>{currentNamespace || "default"}</code></div>
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
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search contexts... (Ctrl+F)"
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

          {/* Namespace Switcher */}
          <div className="sectionTitle" style={{ marginTop: "20px" }}>Switch namespace (kubens)</div>
          <div style={{ marginBottom: "10px", fontSize: "13px", color: "#999" }}>
            Current: <code>{currentNamespace}</code>
          </div>
          <div className="row">
            <div className="dropdown">
              <div
                className="dropdownSelected"
                onClick={() => {
                  if (allNamespaces.length === 0) {
                    loadNamespaces();
                  }
                  setNamespaceDropdownOpen(!namespaceDropdownOpen);
                }}
              >
                {selectedNamespace || "Select namespace"}
              </div>
                        
              {namespaceDropdownOpen && (
                <div className="dropdownMenu">
                  {/* 🔍 Search inside dropdown */}
                  <div className="dropdownSearch">
                    <input
                      ref={namespaceSearchInputRef}
                      type="text"
                      placeholder="Search namespaces..."
                      value={namespaceSearchTerm}
                      onChange={(e) => setNamespaceSearchTerm(e.target.value)}
                      autoFocus
                    />
                  </div>
                  {loadingNamespaces && (
                    <div className="dropdownItem">Loading namespaces...</div>
                  )}
                  {!loadingNamespaces && filteredNamespaces.length === 0 && (
                    <div className="dropdownItem">No namespaces found</div>
                  )}
                  {!loadingNamespaces && filteredNamespaces.map((ns) => (
                    <div
                      key={ns}
                      className={`dropdownItem ${ns === currentNamespace ? "active" : ""}`}
                      onClick={() => {
                        setSelectedNamespace(ns);
                        setNamespaceDropdownOpen(false);
                        setNamespaceSearchTerm("");
                      }}
                    >
                      {ns}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              className="btnPrimary"
              disabled={!selectedNamespace || selectedNamespace === currentNamespace || loadingNamespaces}
              onClick={doSwitchNamespace}
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

          {/* Cluster Connectivity Test */}
          <div className="sectionTitle" style={{ marginTop: "20px" }}>Cluster Info</div>
          <button
            className="btnGhost"
            disabled={!currentContext || testingCluster}
            onClick={testClusterConnection}
            style={{ width: "100%", marginBottom: "10px" }}
          >
            {testingCluster ? "Testing..." : "Test Cluster Connectivity"}
          </button>

          {clusterInfo && (
            <div style={{ 
              padding: "12px", 
              backgroundColor: clusterInfo.reachable ? "#1a3a1a" : "#3a1a1a",
              borderRadius: "6px",
              fontSize: "13px"
            }}>
              <div style={{ marginBottom: "8px" }}>
                <strong>Status:</strong>{" "}
                <span style={{ color: clusterInfo.reachable ? "#4ade80" : "#f87171" }}>
                  {clusterInfo.reachable ? "✓ Connected" : "✗ Unreachable"}
                </span>
              </div>
              
              {clusterInfo.reachable ? (
                <>
                  <div style={{ marginBottom: "6px" }}>
                    <strong>Version:</strong> <code>{clusterInfo.version}</code>
                  </div>
                  <div style={{ marginBottom: "6px" }}>
                    <strong>Auth:</strong>{" "}
                    <span style={{ color: "#4ade80" }}>✓ Authenticated</span>
                  </div>
                  {clusterInfo.serverUrl && (
                    <div style={{ marginBottom: "6px", wordBreak: "break-all" }}>
                      <strong>Server:</strong> <code style={{ fontSize: "11px" }}>{clusterInfo.serverUrl}</code>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ color: "#f87171", fontSize: "12px" }}>
                  {clusterInfo.errorMessage}
                </div>
              )}
            </div>
          )}

          {/* Keyboard Shortcuts Info */}
          <div className="sectionTitle" style={{ marginTop: "20px" }}>⌨️ Shortcuts</div>
          <ul className="list" style={{ fontSize: "12px", color: "#999" }}>
            <li><code>Ctrl+K</code> - Quick context switcher</li>
            <li><code>Ctrl+N</code> - Quick namespace switcher</li>
            <li><code>Ctrl+M</code> - Quick merge</li>
            <li><code>Ctrl+F</code> - Search contexts/namespaces</li>
            <li><code>Esc</code> - Close dropdown</li>
          </ul>
        </div>
      </div>
      <footer style={{ textAlign: "center", padding: "20px", color: "#888", fontSize: "14px" }}>
        Made with ❤️ by Cipheronic
      </footer>
    </div>
  );
}