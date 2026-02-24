import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  contexts: string[];
  selected: string | null;
  onSelect: (ctx: string) => void;
};

export default function ContextDropdown({ contexts, selected, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Filter contexts based on query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contexts;
    return contexts.filter((c) => c.toLowerCase().includes(q));
  }, [contexts, query]);

  // Auto focus input when dropdown opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery(""); // optional: clear when closed
    }
  }, [open]);

  const handleSelect = (ctx: string) => {
    onSelect(ctx);
    setOpen(false);
  };

  return (
    <div className="ctxdd">
      {/* Button that opens dropdown */}
      <button className="ctxdd__trigger" onClick={() => setOpen((v) => !v)}>
        <span>{selected ?? "Select context"}</span>
        <span className="ctxdd__caret">▾</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="ctxdd__panel">
          {/* Search INSIDE dropdown */}
          <div className="ctxdd__search">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to filter contexts (e.g., aks, prod, dev...)"
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                if (e.key === "Enter" && filtered.length > 0) {
                  handleSelect(filtered[0]);
                }
              }}
            />
          </div>

          {/* Context list */}
          <div className="ctxdd__list">
            {filtered.length === 0 ? (
              <div className="ctxdd__empty">No matches</div>
            ) : (
              filtered.map((ctx) => (
                <button
                  key={ctx}
                  className={
                    "ctxdd__item " + (ctx === selected ? "is-selected" : "")
                  }
                  onClick={() => handleSelect(ctx)}
                >
                  {ctx}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}