import { expect, test, type Page } from "@playwright/test";

const chart = (page: Page) => page.locator(".legacy-workspace .chart");
const workspace = (page: Page, name: string) => page.getByRole("navigation", { name: "Workspaces" }).getByRole("button", { name, exact: true });
const view = (page: Page, name: string) => page.locator(".viz .tabs").getByRole("button", { name, exact: true });

async function expectSizedChart(page: Page) {
  await expect.poll(() => chart(page).evaluate((node) => {
    const plot = node as HTMLElement & { _fullLayout?: { width: number; height: number } };
    const parent = node.parentElement!.getBoundingClientRect();
    const rect = node.getBoundingClientRect();
    return !!plot._fullLayout && Math.abs(plot._fullLayout.width - plot.clientWidth) < 2 &&
      Math.abs(plot._fullLayout.height - plot.clientHeight) < 2 &&
      rect.right <= parent.right + 1 && rect.bottom <= parent.bottom + 1;
  })).toBe(true);
}

async function expectBoundedScene(page: Page) {
  await expect.poll(() => chart(page).evaluate((node) => {
    const scene = (node as unknown as { _fullLayout?: { scene?: { aspectratio: Record<string, number>; xaxis: { range: number[] }; yaxis: { range: number[] }; zaxis: { range: number[] } } } })._fullLayout?.scene;
    if (!scene) return false;
    const ratios = ["x", "y", "z"].map((axis) => scene.aspectratio[axis]);
    const ranges = [scene.xaxis.range, scene.yaxis.range, scene.zaxis.range];
    const scales = ranges.map((r, i) => ratios[i] / Math.abs(r[1] - r[0]));
    return ratios.every((r) => Number.isFinite(r) && r > 0 && r <= 2) &&
      Math.max(...scales) / Math.min(...scales) < 1.000001;
  })).toBe(true);
}

test("planar drill paths keep a visible true-scale 3-D scene", async ({ page }, info) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/#workspace");
  await page.getByRole("button", { name: "Load dual-lateral example", exact: true }).click();
  await view(page, "3-D").click();
  await expectBoundedScene(page);
  await expectSizedChart(page);
  await page.locator(".viz").screenshot({ path: info.outputPath("dual-lateral-3d.png") });
});

test("EOU imports at the selected station and survives workspace and view changes", async ({ page }, info) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#workspace");
  await page.getByRole("button", { name: "Load dual-lateral example", exact: true }).click();
  await workspace(page, "EOU").click();
  await expect(page.getByText("Selected station: MD 0.00 ft.")).toBeVisible();
  await page.getByLabel("C_NE", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Import 1σ matrix", exact: true }).click();
  await expect(page.getByText(/Imported 1σ NEV covariance at MD 0.00/)).toBeVisible();
  await view(page, "3-D").click();
  await expect.poll(() => chart(page).evaluate((n) => (n as unknown as { data?: { type: string }[] }).data?.filter((t) => t.type === "mesh3d").length)).toBe(1);
  await expectBoundedScene(page);
  await expectSizedChart(page);
  await page.locator(".viz").screenshot({ path: info.outputPath("eou-3d.png") });
  for (const name of ["Plan", "Profile"]) {
    await view(page, name).click();
    await expect.poll(() => chart(page).evaluate((n) => (n as unknown as { data?: { fill?: string }[] }).data?.filter((t) => t.fill === "toself").length)).toBe(1);
    await expectSizedChart(page);
    await page.locator(".viz").screenshot({ path: info.outputPath(`eou-${name.toLowerCase()}.png`) });
  }
  for (const name of ["Survey", "Planning", "Flight Deck", "Targets", "Centerline", "Depth", "Reports", "EOU"]) {
    await workspace(page, name).click();
  }
  await expect(page.getByLabel("C_NE", { exact: true })).toHaveValue("1");
  await expect(page.getByText(/Imported 1σ NEV covariance at MD 0.00/)).toBeVisible();
  await view(page, "3-D").click();
  await page.getByRole("button", { name: "Show entire path", exact: true }).click();
  await expectBoundedScene(page);
  await page.getByRole("button", { name: "Focus uncertainty", exact: true }).click();
  await expectBoundedScene(page);
  await page.getByLabel("C_NN", { exact: true }).fill("-1");
  await expect(page.getByText(/Imported 1σ NEV covariance/)).toHaveCount(0);
  await page.getByRole("button", { name: "Import 1σ matrix", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(/positive semidefinite|non-PSD/i);
  expect(errors).toEqual([]);
});

test("repeated hide, remount, target and 3-D transitions resize without stale canvases", async ({ page }, info) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#workspace");
  await page.getByRole("button", { name: "Load dual-lateral example", exact: true }).click();
  for (let i = 0; i < 5; i++) {
    await view(page, "3-D").click();
    await expectBoundedScene(page);
    await workspace(page, "Anti-collision").click();
    await expect(page.locator(".legacy-workspace .chart")).toHaveCount(0);
    await workspace(page, "Survey").click();
    await expectBoundedScene(page);
    await view(page, "Target").click();
    await expect(chart(page)).toHaveCount(0);
    await view(page, "Plan").click();
    await view(page, "3-D").click();
  }
  for (const [width, height] of [[2560, 1392], [1100, 760], [1366, 768]]) {
    await page.setViewportSize({ width, height });
    await expectSizedChart(page);
    await expectBoundedScene(page);
    await expect(page.locator(".chart canvas")).toHaveCount(1);
  }
  await page.locator(".app").screenshot({ path: info.outputPath("workspace-after-switching.png") });
  expect(errors).toEqual([]);
  await expect(page.locator(".chart-error")).toHaveCount(0);
});
