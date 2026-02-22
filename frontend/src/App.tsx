import { useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  SelectKubeconfig,
  MergeIntoDefault,
  GetCurrentContext,
  SwitchContext,
  GetAllContexts,
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

export default function App() {
  const [filePath, setFilePath] = useState<string>("");
  const [result, setResult] = useState<MergeResult | null>(null);
  const [status, setStatus] = useState<string>("Ready.");
  const [busy, setBusy] = useState<boolean>(false);

  const [currentContext, setCurrentContext] = useState<string>("");
  const [selectedContext, setSelectedContext] = useState<string>("");
  const [allContexts, setAllContexts] = useState<string[]>([]);

  const canMerge = useMemo(() => filePath.length > 0 && !busy, [filePath, busy]);

  useEffect(() => {
    async function loadContexts() {
      try {
        const contexts = (await GetAllContexts()) as string[];
        setAllContexts(contexts);

        const current = await GetCurrentContext();
        setCurrentContext(current);
        setSelectedContext(current);

        setStatus("Loaded kubeconfig contexts.");
      } catch {
        setStatus("Could not load kubeconfig contexts.");
      }
    }
    loadContexts();
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

      const ctx = await GetCurrentContext();
      setCurrentContext(ctx);
      setSelectedContext(ctx);

      const updated = (await GetAllContexts()) as string[];
      setAllContexts(updated);
    } catch (e: any) {
      setStatus(`Error: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function doSwitch() {
    if (!selectedContext) return;

    try {
      await SwitchContext(selectedContext);

      const ctx = await GetCurrentContext();
      setCurrentContext(ctx);
      setSelectedContext(ctx);

      const updated = (await GetAllContexts()) as string[];
      setAllContexts(updated);

      setStatus(`Switched to: ${ctx}`);
    } catch (e: any) {
      setStatus(`Error switching context: ${e?.message ?? String(e)}`);
    }
  }

  return (
    <div className="container">
      <div className="topbar">
        <div>
          <h1>KubeMerge GUI</h1>
          <p className="subtitle">
            Merge kubeconfigs safely + switch contexts like <code>kubectx</code>
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
              {busy ? "Merging..." : "Merge into ~/.kube/config"}
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

        {/* RIGHT: Context */}
        <div className="card">
          <h2>Context selector</h2>

          <div className="label">Switch context</div>
          <div className="row">
            <select
              value={selectedContext}
              onChange={(e) => setSelectedContext(e.target.value)}
            >
              <option value="">Select context</option>
              {allContexts.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

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
            {allContexts.length > 12 && <li>…and {allContexts.length - 12} more</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}