import { useState, useEffect, useRef } from "react";
import { SearchContexts, QuickSwitchContext, ToggleFloatingMode } from "../../wailsjs/go/main/App";
import { WindowMinimise } from "../../wailsjs/runtime/runtime";
import "./FloatingWidget.css";

interface ContextInfo {
  name: string;
  isCurrent: boolean;
  cluster?: string;
  namespace?: string;
}

export default function FloatingWidget() {
  const [searchQuery, setSearchQuery] = useState("");
  const [contexts, setContexts] = useState<ContextInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Don't set always on top - allow Alt+Tab switching
    // WindowSetAlwaysOnTop(false);
    
    // Load initial contexts
    loadContexts("");
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      loadContexts(searchQuery);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Search as user types with debouncing
    const debounceTimer = setTimeout(() => {
      loadContexts(searchQuery);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const loadContexts = async (query: string) => {
    setLoading(true);
    try {
      const results = await SearchContexts(query);
      setContexts(results || []);
      setSelectedIndex(0);
    } catch (err) {
      console.error("Error searching contexts:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitch = async (contextName: string) => {
    try {
      await QuickSwitchContext(contextName);
      // Refresh the list after switching
      await loadContexts(searchQuery);
    } catch (err) {
      console.error("Error switching context:", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, contexts.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && contexts[selectedIndex]) {
      e.preventDefault();
      handleSwitch(contexts[selectedIndex].name);
    }
  };

  // Display only top 8 contexts when collapsed
  const displayContexts = isCollapsed ? contexts.slice(0, 8) : contexts;

  return (
    <div className="floating-widget">
      <div className="widget-header">
        <span className="widget-title">🎯 Contexts</span>
        <div className="widget-controls">
          <button
            className="widget-btn"
            onClick={async () => {
              try {
                await ToggleFloatingMode();
              } catch (err) {
                console.error("Error toggling floating mode:", err);
              }
            }}
            title="Open Full GUI"
          >
            📱
          </button>
          <button
            className="widget-btn"
            onClick={() => WindowMinimise()}
            title="Minimize Window"
          >
            ━
          </button>
          <button
            className="widget-btn"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? '⬇' : '⬆'}
          </button>
          <button
            className="widget-btn"
            onClick={() => loadContexts(searchQuery)}
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          <div className="widget-search">
            <input
              ref={searchInputRef}
              type="text"
              className="widget-search-input"
              placeholder="🔍 Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          <div className="widget-info">
            {loading ? (
              <span className="widget-loading">Loading...</span>
            ) : (
              <span className="widget-count">
                {contexts.length} context{contexts.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </>
      )}

      <div className="widget-contexts">
        {displayContexts.map((ctx, index) => (
          <div
            key={ctx.name}
            className={`widget-context-item ${ctx.isCurrent ? 'current' : ''} ${
              index === selectedIndex ? 'selected' : ''
            }`}
            onClick={() => handleSwitch(ctx.name)}
            title={ctx.name}
          >
            <span className="context-indicator">
              {ctx.isCurrent ? '✓' : '○'}
            </span>
            <span className="context-name">{ctx.name}</span>
          </div>
        ))}
        
        {displayContexts.length === 0 && !loading && (
          <div className="widget-empty">No contexts found</div>
        )}
        
        {isCollapsed && contexts.length > 8 && (
          <div className="widget-more">
            +{contexts.length - 8} more...
          </div>
        )}
      </div>
    </div>
  );
}
