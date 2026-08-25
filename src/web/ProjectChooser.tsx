import { useEffect, useState } from "react";
import { getPlatform, type ProjectSummary } from "../platform";

interface Props {
  onClose: () => void;
  onOpen: (id: string) => void;
}

export function ProjectChooser({ onClose, onOpen }: Props) {
  const [rows, setRows] = useState<ProjectSummary[]>([]);
  const [error, setError] = useState("");

  async function refresh() {
    setRows(await getPlatform().repo.list());
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="modal-back" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-labelledby="chooser-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="chooser-title">Local browser projects</h2>
        <p className="muted">
          Stored in this browser only (IndexedDB). Not uploaded. Not the same as a desktop
          *.delvepath SQLite file.
        </p>
        {error && <p className="issues error">{error}</p>}
        {rows.length === 0 ? (
          <p>No saved browser projects yet.</p>
        ) : (
          <ul className="project-list">
            {rows.map((p) => (
              <li key={p.id}>
                <button type="button" className="primary" onClick={() => onOpen(p.id)}>
                  Open {p.name}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const name = window.prompt("Rename project", p.name);
                    if (!name?.trim()) return;
                    await getPlatform().repo.rename(p.id, name.trim());
                    await refresh();
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm(`Delete local project “${p.name}”? This cannot be undone.`)) {
                      return;
                    }
                    try {
                      await getPlatform().repo.deleteProject(p.id);
                      await refresh();
                    } catch (e) {
                      setError(String(e));
                    }
                  }}
                >
                  Delete
                </button>
                <span className="muted">{p.updatedAt ? new Date(p.updatedAt).toLocaleString() : ""}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="modal-nav">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
