import { useEffect, useState } from "react";
import { GLOSSARY } from "./glossary";

const explanations: Record<string, string> = {
  Survey: "Enter measured depth, inclination and direction. Minimum Curvature reconstructs the hole between your survey stations. Accept reviewed rows before forecasting.",
  Planning: "Build a comparison path to a target. The plan appears beside the measured hole and is available to Flight Deck.",
  "Flight Deck": "Estimate where the bit is beyond the survey tool, then select a next-stand forecast. Clicking a card changes the cyan path in the viewer.",
  "Anti-collision": "Check the active hole and selected forecast against the other holes in this project. Entered uncertainty and physical hole sizes reduce the available space.",
  EOU: "Position uncertainty: a translucent region around a survey or forecast point. It uses the spread and source you enter.",
  Targets: "Set where you want the hole to go. Targets belong to a hole and appear in all three views.",
  Centerline: "Find the closest distance between two survey centre lines. This comparison does not subtract hole sizes or uncertainty.",
  Depth: "Compare depth references such as rig floor and sea level. Always state which reference a number uses.",
  Reports: "Review and export the surveys and comparison plan currently loaded in this project.",
  "Plan": "Look down from above: North is up and East is right. The plotted axes have the same length scale.",
  "Profile": "Look from the side along the section direction. Depth increases down the screen.",
  "3-D": "Drag to rotate the hole; scroll to zoom. Cyan is the selected option, amber the estimate or comparison, and translucent shapes show entered uncertainty.",
  "Show entire path": "Zoom out to include the complete hole and visible layers. Small forecast differences may become hard to see at this scale.",
  "Focus ahead": "Zoom into the paths being compared so the next-stand changes are visible.",
  "Focus uncertainty": "Zoom into the imported position-error ellipsoid while keeping the hole in the same coordinate system.",
  "Use active hole & forecast": "Take a new calculation snapshot of this hole, the selected Flight Deck forecast, other project holes and their declared envelopes. Required whenever the inputs have changed.",
  "Generate drill path": "Try 65 geometric routes to the chosen endpoint. Keep options within the entered bend and clearance limits. This creates planned comparison curves.",
  "Load crossing demo": "Load three synthetic holes into the whole workspace. One crosses ahead and one lies below, so a correction must clear both.",
  "Import 1σ matrix": "Check the position-error values and source, then draw the 95% ellipsoid at the selected point. If declared for the whole hole, the envelope becomes available to Clearance.",
  "Maximum dogleg": "Largest allowed bend rate anywhere along a candidate, in degrees per 30 m or per 100 ft.",
  "Search excursion": "Maximum sideways or high-side detour explored by the geometric search. This is a search limit, not a steering command.",
  "Additional clearance margin": "Extra distance added after allowing for both hole radii and both uncertainty envelopes.",
  "Confidence": "Probability level used to size each individual Gaussian ellipsoid. It is not the probability that a whole route avoids collision.",
  "Current path": "The supplied or reconstructed path behind the start of the forecast.",
  "Offset holes": "The other holes in the same declared coordinate frame.",
  "Uncorrected route": "An endpoint-constrained comparison route before adding a detour. The Flight Deck forecast is screened separately when supplied.",
  "Correction path": "The currently selected candidate from the geometric search.",
  "Clearance connectors": "Lines joining the closest sampled positions on the compared paths.",
  "Uncertainty": "Show or hide the position-error ellipsoids. The calculations retain their envelopes when the display layer is hidden.",
  "Selected forecast": "Show or hide the forecast selected in Flight Deck and its next-survey marker.",
  "Estimated bit": "The assumed interval from the accepted survey tool position to the bit.",
  "Accept unreviewed": "Mark the unreviewed input rows as accepted. The last accepted row becomes the Flight Deck anchor. This records your review choice; it does not independently validate the measurements.",
  "Export this comparison": "Download entered assumptions, the accepted survey, bit estimate, all three forecasts, your selection and the engine source fingerprint.",
  "Export audit JSON": "Download the full clearance calculation, inputs, all tested candidates and content hashes so the result can be replayed.",
  "Save run to project": "Store an immutable clearance calculation with this hole in the local project.",
  "Explain mode": "Leave this on to see plain-language help as you hover or tab through the controls. Escape dismisses a help bubble.",
  New: "Create a local project for survey data, holes, targets and saved calculations.",
  Open: "Open a saved project. Browser and Windows projects use different storage formats.",
  Save: "Write the current survey and targets to the open local project.",
  "Add row": "Append a measured survey row. The starting inclination and direction copy the previous row; replace them with the new survey.",
  "C_NN": "North/South variance: the square of its one-standard-deviation spread.",
  "C_EE": "East/West variance: the square of its one-standard-deviation spread.",
  "C_VV": "Vertical variance: the square of its one-standard-deviation spread.",
  "C_NE": "North/East covariance. A nonzero value rotates the error region in plan view.",
  "C_NV": "North/vertical covariance. This describes correlated error in those directions.",
  "C_EV": "East/vertical covariance. The full matrix must describe a physically possible error region.",
  "MD": GLOSSARY.md, "INC": GLOSSARY.inc, "AZI": GLOSSARY.azi, "TVD": GLOSSARY.tvd,
};

export function ExplainMode({ enabled }: { enabled: boolean }) {
  const [help, setHelp] = useState<{ title: string; text: string; top: number; left: number } | null>(null);
  useEffect(() => {
    if (!enabled) { setHelp(null); return; }
    function explain(event: Event) {
      if (!(event.target instanceof Element)) return;
      const el = event.target.closest<HTMLElement>("[data-help],button,input,select,summary,th,[data-title]");
      if (!el || el.closest(".explain-bubble")) { setHelp(null); return; }
      const label = el.closest("label");
      const title = (el.getAttribute("aria-label") || el.getAttribute("data-title") || label?.textContent || el.textContent || "Control").replace(/\s+/g," ").trim();
      const custom = el.closest<HTMLElement>("[data-help]")?.dataset.help;
      const known = explanations[title] ?? Object.entries(explanations).find(([key]) => title.startsWith(key + " ") && key.length > 2)?.[1];
      const text = custom || known || el.getAttribute("title") ||
        (el instanceof HTMLInputElement ? (el.type === "checkbox" ? "Toggle " + title + ". Display-layer switches affect the picture only; they do not change the calculation." : "Enter " + title + ". Values use the active hole's stated units. Changes are reflected in the current calculation.") :
        el instanceof HTMLSelectElement ? "Choose " + title + ". The selected value is used by this workspace." :
        el.tagName === "SUMMARY" ? "Open the detailed inputs, explanation or calculation record for " + title + "." :
        "Use " + title + " for the active hole. Watch the result message and shared viewer for the outcome.");
      const r = el.getBoundingClientRect();
      setHelp({ title: title.slice(0,90), text, top: Math.max(8, Math.min(window.innerHeight - 165, r.bottom + 8)), left: Math.max(8, Math.min(window.innerWidth - 370, r.left)) });
    }
    const dismiss = (e: KeyboardEvent) => { if (e.key === "Escape") setHelp(null); };
    document.addEventListener("pointerover", explain); document.addEventListener("focusin", explain);
    document.addEventListener("keydown", dismiss);
    return () => { document.removeEventListener("pointerover", explain); document.removeEventListener("focusin", explain); document.removeEventListener("keydown", dismiss); };
  }, [enabled]);
  return enabled && help ? <aside role="tooltip" className="explain-bubble" style={{ top: help.top, left: help.left }}><b>{help.title}</b><p>{help.text}</p></aside> : null;
}
