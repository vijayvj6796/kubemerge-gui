import { useState, useEffect, useRef } from "react";
import { SearchContexts, QuickSwitchContext } from "../../wailsjs/go/main/App";
import { EventsOn } from "../../wailsjs/runtime/runtime";

interface ContextInfo {
  name: string;
  isCurrent: boolean;
  cluster?: string;
  namespace?: string;
}

interface ContextSearchModalProps {
  onClose: () => void;
}

export default function ContextSearchModal({ onClose }: ContextSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [contexts, setContexts] = useState<ContextInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus search input
    searchInputRef.current?.focus();
    
    // Load initial contexts
    loadContexts("");
  }, []);

  useEffect(() => {
    // Search as user types
    const debounceTimer = setTimeout(() => {
      loadContexts(searchQuery);
    }, 200);

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
      onClose();
    } catch (err) {
      console.error("Error switching context:", err);
      alert(`Failed to switch context: ${err}`);
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
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="context-search-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="context-search-modal">
        <div className="context-search-header">
          <h2>🔍 Search & Switch Context</h2>
          <button onClick={onClose} className="close-btn">
            ✕
          </button>
        </div>

        <input
          ref={searchInputRef}
          type="text"
          className="context-search-input"
          placeholder="Type to search contexts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <div className="context-search-help">
          <span>↑↓ Navigate</span>
          <span>Enter Select</span>
          <span>Esc Close</span>
        </div>

        <div className="context-search-results">
          {loading ? (
            <div className="context-search-loading">Loading...</div>
          ) : contexts.length === 0 ? (
            <div className="context-search-empty">
              {searchQuery ? "No contexts found" : "No contexts available"}
            </div>
          ) : (
            contexts.map((ctx, index) => (
              <div
                key={ctx.name}
                className={`context-search-item ${
                  index === selectedIndex ? "selected" : ""
                } ${ctx.isCurrent ? "current" : ""}`}
                onClick={() => handleSwitch(ctx.name)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="context-name">
                  {ctx.isCurrent && <span className="checkmark">✓ </span>}
                  <span className="name">{ctx.name}</span>
                  {ctx.isCurrent && (
                    <span className="badge current-badge">Current</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="context-search-footer">
          <span>{contexts.length} context{contexts.length !== 1 ? "s" : ""} found</span>
        </div>
      </div>

      <style>{`
        .context-search-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }

        .context-search-modal {
          background: #1e1e1e;
          border-radius: 12px;
          width: 90%;
          max-width: 600px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          border: 1px solid #333;
        }

        .context-search-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #333;
        }

        .context-search-header h2 {
          margin: 0;
          font-size: 18px;
          color: #fff;
        }

        .close-btn {
          background: none;
          border: none;
          color: #888;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
        }

        .close-btn:hover {
          background: #333;
          color: #fff;
        }

        .context-search-input {
          width: calc(100% - 40px);
          margin: 20px;
          padding: 12px 16px;
          font-size: 16px;
          border: 2px solid #333;
          border-radius: 8px;
          background: #2a2a2a;
          color: #fff;
          outline: none;
        }

        .context-search-input:focus {
          border-color: #0078d4;
        }

        .context-search-help {
          display: flex;
          gap: 16px;
          padding: 0 20px 12px;
          font-size: 12px;
          color: #888;
        }

        .context-search-help span {
          background: #2a2a2a;
          padding: 4px 8px;
          border-radius: 4px;
        }

        .context-search-results {
          flex: 1;
          overflow-y: auto;
          padding: 0 20px 20px;
          min-height: 200px;
          max-height: 400px;
        }

        .context-search-loading,
        .context-search-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 200px;
          color: #888;
          font-size: 14px;
        }

        .context-search-item {
          padding: 12px 16px;
          margin-bottom: 8px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          border: 2px solid transparent;
        }

        .context-search-item:hover,
        .context-search-item.selected {
          background: #2a2a2a;
          border-color: #0078d4;
        }

        .context-search-item.current {
          background: #1a3a1a;
        }

        .context-search-item.current.selected {
          background: #2a4a2a;
          border-color: #4CAF50;
        }

        .context-name {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .context-name .checkmark {
          color: #4CAF50;
          font-weight: bold;
        }

        .context-name .name {
          color: #fff;
          font-size: 14px;
          flex: 1;
        }

        .badge {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 600;
        }

        .current-badge {
          background: #4CAF50;
          color: #fff;
        }

        .context-search-footer {
          padding: 12px 20px;
          border-top: 1px solid #333;
          font-size: 12px;
          color: #888;
          text-align: center;
        }
      `}</style>
    </div>
  );
}

// Hook to listen for tray context search events
export function useContextSearchModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const unlisten = EventsOn("show-context-search", () => {
      setIsOpen(true);
    });

    return () => {
      // Cleanup if needed
    };
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };
}
