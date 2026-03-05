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
  GetContextDetails,
  SetTargetKubeconfig,
} from "../wailsjs/go/main/App";
import { EventsOn } from "../wailsjs/runtime/runtime";
import ContextDropdown from "./components/ContextDropdown";
import ContextSearchModal, { useContextSearchModal } from "./components/ContextSearchModal";
import FloatingWidget from "./components/FloatingWidget";

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

type ContextDetails = {
  contextName: string;
  clusterName: string;
  clusterUrl: string;
  userName: string;
  namespace: string;
  certExpiration: string;
  certExpiresInDays: number;
  hasCertExpiration: boolean;
  certExpirationWarning: string;
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
  
  // Context details
  const [contextDetails, setContextDetails] = useState<ContextDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  
  // Refs for keyboard shortcuts
  const searchInputRef = useRef<HTMLInputElement>(null);
  const namespaceSearchInputRef = useRef<HTMLInputElement>(null);
  
  // Context search modal from system tray
  const contextSearchModal = useContextSearchModal();
  
  // Floating widget state - START IN FLOATING MODE
  const [showFloatingWidget, setShowFloatingWidget] = useState(true);
  const [floatingModeEnabled, setFloatingModeEnabled] = useState(true);

  const canMerge = useMemo(() => filePath.length > 0 && !busy, [filePath, busy]);

  // Detect OS on mount and auto-load default target
  useEffect(() => {
    async function detectOSAndLoadTarget() {
      try {
        const detectedOS = await GetOS();
        setOs(detectedOS);
        // Auto-select appropriate default target
        if (detectedOS === "windows") {
          setTargetKind("windows");
          setStatus(`Running on Windows. Loading default Windows kubeconfig...`);
          // Auto-load Windows target
          await loadFromTarget("windows", "", "");
        } else {
          setTargetKind("linux");
          setStatus(`Running on ${detectedOS}. Loading Linux kubeconfig...`);
          // Auto-load Linux target
          await loadFromTarget("linux", "", "");
        }
      } catch (e: any) {
        setStatus(`Failed to detect OS or load target: ${e?.message ?? String(e)}`);
      }
    }
    detectOSAndLoadTarget();
  }, []);
  
  // Listen for floating widget toggle event from tray
  useEffect(() => {
    const unlisten = EventsOn("toggle-floating-widget", () => {
      setShowFloatingWidget((prev) => !prev);
    });

    return () => {
      // Cleanup handled by Wails
    };
  }, []);
  
  // Listen for floating mode toggle event from tray
  useEffect(() => {
    const unlistenMode = EventsOn("toggle-floating-mode", () => {
      setFloatingModeEnabled((prev) => !prev);
      setShowFloatingWidget(true);
    });
    
    const unlistenSet = EventsOn("set-floating-mode", (enabled: boolean) => {
      setFloatingModeEnabled(enabled);
      setShowFloatingWidget(enabled);
    });

    return () => {
      // Cleanup handled by Wails
    };
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
      
      // Update backend so tray uses the correct kubeconfig
      await SetTargetKubeconfig(path);
      
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

  async function loadContextDetails() {
    if (!targetPath || !currentContext) {
      setStatus("No context selected. Load target first.");
      return;
    }

    setLoadingDetails(true);
    setStatus("Loading context details...");

    try {
      const details = (await GetContextDetails(targetPath, currentContext)) as ContextDetails;
      setContextDetails(details);
      setStatus(`Loaded details for context: ${currentContext}`);
    } catch (e: any) {
      setStatus(`Failed to load context details: ${e?.message ?? String(e)}`);
      setContextDetails(null);
    } finally {
      setLoadingDetails(false);
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
    <div className={`container ${floatingModeEnabled ? 'floating-mode' : ''}`} style={floatingModeEnabled ? {
      background: 'transparent',
      overflow: 'hidden',
      padding: 0
    } : {}}>
      {/* Floating mode - show only the widget */}
      {floatingModeEnabled ? (
        <div style={{ 
          width: '100%', 
          height: '100%', 
          display: 'flex', 
          alignItems: 'flex-start', 
          justifyContent: 'flex-start',
          padding: '0'
        }}>
          <FloatingWidget />
        </div>
      ) : (
        <>
          <div className="topbar">
        <div>
          <h1>⚡ KubeMerge GUI</h1>
          <p className="subtitle">
            Merge kubeconfigs safely + switch contexts (Windows / WSL) like{" "}
            <code>kubectx</code>
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            className="btnGhost"
            onClick={() => setShowFloatingWidget(!showFloatingWidget)}
            style={{ fontSize: 13, padding: "6px 12px" }}
            title="Toggle floating context widget"
          >
            {showFloatingWidget ? '🔻 Hide Widget' : '🎯 Show Widget'}
          </button>
          <div className="badge">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ opacity: 0.6 }}>Context:</span> 
              <code style={{ fontWeight: 600 }}>{currentContext || "(none)"}</code>
            </div>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ opacity: 0.6 }}>Namespace:</span> 
              <code style={{ fontWeight: 600 }}>{currentNamespace || "default"}</code>
            </div>
          </div>
        </div>
      </div>

      <div className="statusbar">{status}</div>

      <div className="grid">
        {/* LEFT: Merge */}
        <div className="card">
          <h2>📦 Merge kubeconfig</h2>

          <div className="label">Selected file</div>
          <div className="pathbox">{filePath || "No file selected"}</div>

          <div className="row" style={{ marginTop: "14px" }}>
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
              📁 Select kubeconfig
            </button>

            <button className="btnPrimary" disabled={!canMerge} onClick={runMerge}>
              {busy ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="spinner"></span> Merging...
                </span>
              ) : (
                "🔀 Merge into target"
              )}
            </button>
          </div>

          {result && (
            <>
              <div className="sectionTitle">✅ Last merge result</div>

              <div className="infoBox infoBox-success" style={{ marginBottom: "12px" }}>
                <div style={{ marginBottom: "8px", fontWeight: 600, fontSize: "13px" }}>
                  Merge completed successfully!
                </div>
                <div style={{ fontSize: "12px", opacity: 0.9 }}>
                  {result.message}
                </div>
              </div>

              <div className="label">Target</div>
              <div className="pathbox">{result.targetConfigPath}</div>

              <div className="label" style={{ marginTop: "12px" }}>
                Backup
              </div>
              <div className="pathbox">{result.backupPath || "(none)"}</div>

              <div className="sectionTitle">📊 Added Resources</div>
              <div className="infoBox infoBox-info" style={{ fontSize: "12px" }}>
                <div style={{ marginBottom: "6px" }}>
                  <strong>Clusters:</strong> {result.addedClusters.length > 0 ? (
                    <code>{result.addedClusters.join(", ")}</code>
                  ) : (
                    <span style={{ opacity: 0.6 }}>(none)</span>
                  )}
                </div>
                <div style={{ marginBottom: "6px" }}>
                  <strong>Contexts:</strong> {result.addedContexts.length > 0 ? (
                    <code>{result.addedContexts.join(", ")}</code>
                  ) : (
                    <span style={{ opacity: 0.6 }}>(none)</span>
                  )}
                </div>
                <div>
                  <strong>Users:</strong> {result.addedUsers.length > 0 ? (
                    <code>{result.addedUsers.join(", ")}</code>
                  ) : (
                    <span style={{ opacity: 0.6 }}>(none)</span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* RIGHT: Target + Context */}
        <div className="card">
          <h2>🎯 Target & Context</h2>

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
              className="btnPrimary"
              onClick={async () => {
                await loadFromTarget(targetKind, wslDistro, linuxUser);
              }}
            >
              🔄 Load Target
            </button>
          </div>

          <div className="label">Resolved kubeconfig path</div>
          <div className="pathbox">{targetPath || "(not loaded yet)"}</div>


          <div className="sectionTitle">🔄 Switch context (kubectx)</div>
          <div style={{ marginBottom: "10px", fontSize: "13px", color: "var(--muted2)" }}>
            Current: <code style={{ color: "var(--primary)", fontWeight: 600 }}>{currentContext || "(none)"}</code>
          </div>
          <div className="row">
            <div className="dropdown">
              <div
                className="dropdownSelected"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <span>{selectedContext || "Select context"}</span>
                <span style={{ opacity: 0.5 }}>▼</span>
              </div>
                        
                {dropdownOpen && (
                  <div className="dropdownMenu">
                    {/* 🔍 Search inside dropdown */}
                    <div className="dropdownSearch">
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="🔍 Search contexts..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                      />
                    </div>
                    {filteredContexts.length === 0 && (
                      <div className="dropdownItem" style={{ opacity: 0.6, cursor: "default" }}>
                        No contexts found
                      </div>
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
                        {c === currentContext && <span style={{ marginRight: 8 }}>✓</span>}
                        {c}
                      </div>
                    ))}
                  </div>
                )}
            </div>

            <button
              className="btnSuccess"
              disabled={!selectedContext || selectedContext === currentContext}
              onClick={doSwitch}
            >
              ✓ Switch
            </button>
          </div>

          {/* Namespace Switcher */}
          <div className="sectionTitle" style={{ marginTop: "20px" }}>📦 Switch namespace (kubens)</div>
          <div style={{ marginBottom: "10px", fontSize: "13px", color: "var(--muted2)" }}>
            Current: <code style={{ color: "var(--info)", fontWeight: 600 }}>{currentNamespace}</code>
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
                <span>{selectedNamespace || "Select namespace"}</span>
                <span style={{ opacity: 0.5 }}>▼</span>
              </div>
                        
              {namespaceDropdownOpen && (
                <div className="dropdownMenu">
                  <div className="dropdownSearch">
                    <input
                      ref={namespaceSearchInputRef}
                      type="text"
                      placeholder="🔍 Search namespaces..."
                      value={namespaceSearchTerm}
                      onChange={(e) => setNamespaceSearchTerm(e.target.value)}
                      autoFocus
                    />
                  </div>
                  {loadingNamespaces && (
                    <div className="dropdownItem" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="spinner"></span> Loading namespaces...
                    </div>
                  )}
                  {!loadingNamespaces && filteredNamespaces.length === 0 && (
                    <div className="dropdownItem" style={{ opacity: 0.6, cursor: "default" }}>
                      No namespaces found
                    </div>
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
                      {ns === currentNamespace && <span style={{ marginRight: 8 }}>✓</span>}
                      {ns}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              className="btnSuccess"
              disabled={!selectedNamespace || selectedNamespace === currentNamespace || loadingNamespaces}
              onClick={doSwitchNamespace}
            >
              ✓ Switch
            </button>
          </div>

          {/* Context Details View */}
          <div className="sectionTitle" style={{ marginTop: "20px" }}>📋 Context Details</div>
          <button
            className="btnGhost"
            disabled={!currentContext || loadingDetails}
            onClick={loadContextDetails}
            style={{ width: "100%", marginBottom: "10px" }}
          >
            {loadingDetails ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span className="spinner"></span> Loading...
              </span>
            ) : (
              "🔍 Load Context Details"
            )}
          </button>

          {contextDetails && (
            <div className="infoBox infoBox-neutral" style={{ marginBottom: "10px" }}>
              <div style={{ marginBottom: "10px", paddingBottom: "10px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                <strong style={{ color: "var(--text)" }}>Context:</strong> <code>{contextDetails.contextName}</code>
              </div>
              <div style={{ marginBottom: "8px" }}>
                <strong>Cluster:</strong> <code>{contextDetails.clusterName}</code>
              </div>
              {contextDetails.clusterUrl && (
                <div style={{ marginBottom: "8px", wordBreak: "break-all" }}>
                  <strong>Cluster URL:</strong><br/>
                  <code style={{ fontSize: "11px", display: "block", marginTop: 4 }}>{contextDetails.clusterUrl}</code>
                </div>
              )}
              <div style={{ marginBottom: "8px" }}>
                <strong>User:</strong> <code>{contextDetails.userName}</code>
              </div>
              <div style={{ marginBottom: "8px" }}>
                <strong>Namespace:</strong> <code>{contextDetails.namespace}</code>
              </div>
              
              {contextDetails.hasCertExpiration && (
                <>
                  <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                    <div style={{ marginBottom: "8px" }}>
                      <strong>Certificate Expiration:</strong>{" "}
                      <code>{new Date(contextDetails.certExpiration).toLocaleDateString()}</code>
                    </div>
                    <div style={{ marginBottom: "8px" }}>
                      <strong>Days Until Expiry:</strong>{" "}
                      <code style={{ 
                        color: contextDetails.certExpiresInDays < 0 ? "#f87171" : 
                               contextDetails.certExpiresInDays <= 7 ? "#fb923c" : 
                               contextDetails.certExpiresInDays <= 30 ? "#fbbf24" : "#4ade80"
                      }}>
                        {contextDetails.certExpiresInDays < 0 ? "EXPIRED" : `${contextDetails.certExpiresInDays} days`}
                      </code>
                    </div>
                  </div>
                  {contextDetails.certExpirationWarning && (
                    <div className={`infoBox ${contextDetails.certExpiresInDays < 0 ? 'infoBox-error' : 'infoBox-warning'}`} style={{ 
                      marginTop: "10px",
                      padding: "10px 12px",
                      fontSize: "12px",
                      fontWeight: 600
                    }}>
                      {contextDetails.certExpirationWarning}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="sectionTitle">📋 All Contexts ({allContexts.length})</div>
          <ul className="list" style={{ 
            maxHeight: "300px", 
            overflowY: "auto", 
            padding: "8px 0 8px 8px", 
            margin: 0,
            listStyle: "none"
          }}>
            {allContexts.slice(0, 15).map((c) => (
              <li key={c} style={{ 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "space-between",
                padding: "8px 10px",
                marginBottom: "4px",
                background: c === currentContext ? "rgba(59, 130, 246, 0.12)" : "rgba(255,255,255,0.03)",
                borderRadius: "8px",
                border: `1px solid ${c === currentContext ? "rgba(59, 130, 246, 0.3)" : "rgba(255,255,255,0.06)"}`,
                transition: "all 0.2s ease"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                  {c === currentContext && <span style={{ color: "var(--primary)" }}>✓</span>}
                  <code style={{ 
                    fontSize: "12px",
                    fontWeight: c === currentContext ? 600 : 400,
                    color: c === currentContext ? "var(--text)" : "var(--muted)"
                  }}>
                    {c}
                  </code>
                </div>
                <button
                  className="btnDanger"
                  style={{ fontSize: 11, padding: "4px 10px", minWidth: "auto" }}
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
                  🗑️ Delete
                </button>
              </li>
            ))}
            {allContexts.length > 15 && (
              <li style={{ 
                padding: "8px 10px", 
                textAlign: "center", 
                opacity: 0.6,
                fontSize: "12px"
              }}>
                …and {allContexts.length - 15} more contexts
              </li>
            )}
            {allContexts.length === 0 && (
              <li style={{ 
                padding: "20px", 
                textAlign: "center", 
                opacity: 0.5,
                fontSize: "13px"
              }}>
                No contexts loaded. Click "Load Target" above.
              </li>
            )}
          </ul>

          {/* Cluster Connectivity Test */}
          <div className="sectionTitle" style={{ marginTop: "20px" }}>🌐 Cluster Info</div>
          <button
            className="btnGhost"
            disabled={!currentContext || testingCluster}
            onClick={testClusterConnection}
            style={{ width: "100%", marginBottom: "10px" }}
          >
            {testingCluster ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span className="spinner"></span> Testing...
              </span>
            ) : (
              "🔌 Test Cluster Connectivity"
            )}
          </button>

          {clusterInfo && (
            <div className={`infoBox ${clusterInfo.reachable ? 'infoBox-success' : 'infoBox-error'}`}>
              <div style={{ marginBottom: "10px", fontSize: "14px", fontWeight: 600 }}>
                {clusterInfo.reachable ? "✓ Connected" : "✗ Unreachable"}
              </div>
              
              {clusterInfo.reachable ? (
                <>
                  <div style={{ marginBottom: "8px" }}>
                    <strong>Version:</strong> <code>{clusterInfo.version}</code>
                  </div>
                  <div style={{ marginBottom: "8px" }}>
                    <strong>Auth:</strong>{" "}
                    <span style={{ color: "#4ade80" }}>✓ Authenticated</span>
                  </div>
                  {clusterInfo.serverUrl && (
                    <div style={{ wordBreak: "break-all" }}>
                      <strong>Server:</strong><br/>
                      <code style={{ fontSize: "11px", display: "block", marginTop: 4 }}>{clusterInfo.serverUrl}</code>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: "12px", lineHeight: 1.6 }}>
                  {clusterInfo.errorMessage}
                </div>
              )}
            </div>
          )}

          {/* Keyboard Shortcuts Info */}
          <div className="sectionTitle" style={{ marginTop: "20px" }}>⌨️ Keyboard Shortcuts</div>
          <div className="infoBox infoBox-info" style={{ fontSize: "12px" }}>
            <div style={{ marginBottom: "6px" }}><kbd style={{ background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: "4px", fontFamily: "monospace" }}>Ctrl+K</kbd> Quick context switcher</div>
            <div style={{ marginBottom: "6px" }}><kbd style={{ background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: "4px", fontFamily: "monospace" }}>Ctrl+N</kbd> Quick namespace switcher</div>
            <div style={{ marginBottom: "6px" }}><kbd style={{ background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: "4px", fontFamily: "monospace" }}>Ctrl+M</kbd> Quick merge</div>
            <div style={{ marginBottom: "6px" }}><kbd style={{ background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: "4px", fontFamily: "monospace" }}>Ctrl+F</kbd> Search contexts/namespaces</div>
            <div><kbd style={{ background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: "4px", fontFamily: "monospace" }}>Esc</kbd> Close dropdown</div>
          </div>
        </div>
      </div>
      <footer style={{ textAlign: "center", padding: "24px", color: "#666", fontSize: "13px", marginTop: "20px" }}>
        Made with ❤️ by Cipheronic
      </footer>
        </>
      )}
      
      {/* Context Search Modal (triggered from system tray) */}
      {contextSearchModal.isOpen && (
        <ContextSearchModal onClose={contextSearchModal.close} />
      )}
      
      {/* Floating Context Widget (when not in floating mode) */}
      {!floatingModeEnabled && showFloatingWidget && <FloatingWidget />}
    </div>
  );
}