// Connect only to a locally launched, isolated WebView2 debug instance.
// Set WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9237
// and WEBVIEW2_USER_DATA_FOLDER to an isolated verification directory before launch.
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
const browser = await chromium.connectOverCDP("http://127.0.0.1:9237");
try {
  const page = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().includes("tauri.localhost"));
  if (!page) throw new Error("No local DelvePath WebView found");
  await page.setViewportSize({ width: 1366, height: 768 });
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("button", { name: "Anti-collision", exact: true }).click();
  const generate = page.getByRole("button", { name: "Generate drill path", exact: true });
  await generate.waitFor();
  await page.waitForFunction(() => !Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "Generate drill path")?.disabled);
  await generate.click(); await page.getByLabel("Correction candidate").waitFor();
  const cards = await page.locator(".collision-comparison").innerText();
  mkdirSync("artifacts/verification", { recursive: true });
  await page.screenshot({ path: "artifacts/verification/desktop-anti-collision.png" });
  const path = resolve(`artifacts/verification/native-smoke-${randomUUID()}.delvepath`);
  const persistence = await page.evaluate(async ({ path }) => {
    const invoke = window.__TAURI_INTERNALS__.invoke;
    const project = await invoke("create_project", { path, name: "Synthetic verification", client: "Offline test" });
    const input = JSON.parse(await invoke("engine_call", { req: JSON.stringify({ op: "collision_demo", payload: {} }) }));
    const result = JSON.parse(await invoke("engine_call", { req: JSON.stringify({ op: "generate_drill_path", payload: input }) }));
    const hole = { id: "verification-hole", project_id: project.id, name: "Constructed collision audit", unit_system: "metric", survey_convention: "oilfield_from_vertical", azimuth_reference: "grid", vsp_deg: 0, declination_note: "", grid_note: "", parent_hole_id: null, branch_md: null, color: null, origin_id: input.frame.origin_id, origin_north: 0, origin_east: 0, vertical_datum: "rkb", vertical_datum_name: input.frame.vertical_datum_name, crs_epsg: null, crs_note: "Synthetic verification" };
    await invoke("save_hole", { hole });
    const payload = JSON.stringify(result);
    const doc = { id: `${hole.id}:collision:roundtrip`, hole_id: hole.id, kind: "scan", payload, updated_at: new Date().toISOString() };
    await invoke("save_document", { doc });
    await invoke("open_project", { path });
    const loaded = await invoke("load_documents", { holeId: hole.id, kind: "scan" });
    const stations = await invoke("load_stations", { holeId: hole.id });
    return { equal: loaded[0]?.payload === payload, count: loaded.length, measuredRows: stations.length, candidates: result.ledger.length };
  }, { path });
  if (errors.length || !persistence.equal || persistence.measuredRows !== 0 || !cards.includes("1.47 m")) throw new Error(JSON.stringify({ errors, persistence, cards }));
  const evidence = { nativeWebview: true, viewport: { width: 1366, height: 768 }, cards, errors, persistence };
  writeFileSync("artifacts/verification/desktop-smoke.json", JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
} finally { await browser.close(); }
