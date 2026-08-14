import { useState } from "react";

interface Props {
  onClose: () => void;
  onLoadOregon: () => void;
  onLoadDual: () => void;
  onSampleTarget: () => void;
  onGoTab: (tab: "plan" | "profile" | "3d" | "target") => void;
  tipsOn: boolean;
  onTips: (on: boolean) => void;
}

const STEPS: { title: string; body: string; action?: "oregon" | "dual" | "target" | "plan" | "profile" | "3d" }[] = [
  {
    title: "What this is",
    body: "DelvePath reconstructs a borehole from MD, INC, and AZI using Minimum Curvature. It is a prototype — not certified, not for steering or collision avoidance. Hover labels (when Tips is on) explain each term.",
  },
  {
    title: "Files",
    body: "New creates a local *.delvepath project (SQLite). Open reloads one. Save and autosave keep the hole. That is DelvePath’s job file — not a WinSERVE .SVY. Import CSV to bring in MD/INC/AZI from a spreadsheet. Export CSV / Report leave with calculated TVD, N, E, VS, and a class column so projections stay labelled.",
  },
  {
    title: "Load the Oregon example",
    body: "This is a real public WinSERVE survey (24c-23-65). It sets feet, VSP 165.30°, and a vertical tie-in at 445 ft. Use the button below, or Import CSV from research/golden/fixtures/winserve_oregon_24c-23-65_input.csv.",
    action: "oregon",
  },
  {
    title: "Read the grid",
    body: "White cells are what you type: MD → Tab → INC → Tab → AZI. Add row (or Enter on the last AZI) continues MD and holds last INC/AZI so the new point appears on Plan / Profile / 3-D. Paste a table to append if those MDs are deeper than the last station. Grey cells are calculated. Do not sort a decreasing MD — the engine will error instead. Current Position is the last measured station until you turn on a projection.",
  },
  {
    title: "Views",
    body: "Plan is +North up, +East right. Profile is vertical section vs TVD (TVD down on screen). 3-D is the same path you can orbit. Click a station in the grid; the blue marker should follow.",
    action: "plan",
  },
  {
    title: "Dual-lateral example",
    body: "Load dual-lateral example is SYNTHETIC / constructed — not a golden as-drilled match. One vertical parent lands east; Lateral B branches at the MD 6500 ft station (still vertical) and lands west. Hole picker switches holes. Charts overlay both. Branch from selected station does the same from any measured row (no interpolated kick-off MD).",
    action: "dual",
  },
  {
    title: "Set a target",
    body: "Open the Target tab. Example “Big Sand”: N −1070, E 270, TVD 2480. Click Set target. You should see numeric deltas and a red X on Plan / Profile / 3-D, just past the last Oregon station. New/Open a project if you want that target saved.",
    action: "target",
  },
  {
    title: "Project ahead",
    body: "Bottom bar: Straight Line holds the last INC/AZI. Try bit-to-sensor 60, then +MD 200. The banner says PROJECTED and the path is dashed amber. This is not WinSERVE’s “trend of last two surveys.” Set the menu back to None when you are done.",
  },
];

export function StartHere({ onClose, onLoadOregon, onLoadDual, onSampleTarget, onGoTab, tipsOn, onTips }: Props) {
  const [i, setI] = useState(0);
  const step = STEPS[i];

  function runAction() {
    if (step.action === "oregon") onLoadOregon();
    if (step.action === "dual") onLoadDual();
    if (step.action === "target") {
      onGoTab("target");
      onSampleTarget();
    }
    if (step.action === "plan") onGoTab("plan");
    if (step.action === "profile") onGoTab("profile");
    if (step.action === "3d") onGoTab("3d");
  }

  return (
    <div className="modal-back" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-labelledby="start-here-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="start-here-title">Start here</h2>
        <p className="modal-step">
          {i + 1} / {STEPS.length} — {step.title}
        </p>
        <p>{step.body}</p>
        {step.action === "oregon" && (
          <button className="primary" onClick={runAction}>
            Load Oregon example
          </button>
        )}
        {step.action === "dual" && (
          <button className="primary" onClick={runAction}>
            Load dual-lateral example
          </button>
        )}
        {step.action === "target" && (
          <button className="primary" onClick={runAction}>
            Fill Big Sand and set target
          </button>
        )}
        {step.action === "plan" && (
          <button className="primary" onClick={runAction}>
            Show Plan view
          </button>
        )}
        <div className="modal-nav">
          <button type="button" disabled={i === 0} onClick={() => setI(i - 1)}>
            Back
          </button>
          {i < STEPS.length - 1 ? (
            <button type="button" className="primary" onClick={() => setI(i + 1)}>
              Next
            </button>
          ) : (
            <button type="button" className="primary" onClick={onClose}>
              Done
            </button>
          )}
        </div>
        <label className="modal-tips">
          <input type="checkbox" checked={tipsOn} onChange={(e) => onTips(e.target.checked)} />
          Show tutorial mouseovers on terms
        </label>
      </div>
    </div>
  );
}
