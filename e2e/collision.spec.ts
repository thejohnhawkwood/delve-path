import { expect, test } from "@playwright/test";

test("crossing case generates a correction, layers work in every view, audit replays", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("./#workspace");
  await page
    .getByRole("button", { name: "Anti-collision", exact: true })
    .click();
  await page.getByRole("button", { name: "Load crossing demo" }).click();
  await expect(page.locator(".workflow-strip")).toContainText("DP-03");
  await page.getByRole("button", { name: "Use active hole & forecast" }).click();
  await expect(
    page.getByRole("button", { name: "Generate drill path", exact: true }),
  ).toBeEnabled({ timeout: 30000 });
  await page.locator(".workspace-nav").scrollIntoViewIfNeeded();
  await expect(page.locator(".comparison-card.baseline strong")).toContainText(
    "-",
  );
  const began = Date.now();
  await page
    .getByRole("button", { name: "Generate drill path", exact: true })
    .click();
  await expect(page.getByLabel("Correction candidate")).toBeVisible({
    timeout: 30000,
  });
  const latency = Date.now() - began;
  await expect(
    page
      .getByRole("group", { name: "Preview layers" })
      .getByLabel("Correction path", { exact: true }),
  ).toBeChecked();
  await expect
    .poll(() =>
      page
        .locator(".viz .chart")
        .evaluate(
          (e) =>
            (e as unknown as { data?: { type: string }[] }).data?.filter(
              (t) => t.type === "mesh3d",
            ).length ?? 0,
        ),
    )
    .toBeGreaterThan(0);
  const layers = page.getByRole("group", { name: "Preview layers" });
  await layers.getByLabel("Uncertainty", { exact: true }).uncheck();
  await expect
    .poll(() =>
      page
        .locator(".viz .chart")
        .evaluate(
          (e) =>
            (e as unknown as { data?: { type: string }[] }).data?.filter(
              (t) => t.type === "mesh3d",
            ).length ?? -1,
        ),
    )
    .toBe(0);
  await layers.getByLabel("Uncertainty", { exact: true }).check();
  await page.screenshot({
    path: info.outputPath("anti-collision-3d.png"),
    fullPage: false,
  });
  for (const view of ["Plan", "Profile"]) {
    await page
      .getByRole("group", { name: "Preview view" })
      .getByRole("button", { name: view, exact: true })
      .click();
    await expect
      .poll(() =>
        page
          .locator(".viz .chart")
          .evaluate(
            (e) =>
              (
                e as unknown as { data?: { type: string; fill?: string }[] }
              ).data?.filter((t) => t.type === "scatter" && t.fill === "toself")
                .length ?? 0,
          ),
      )
      .toBeGreaterThan(0);
    await expect(
      layers.getByLabel("Uncertainty", { exact: true }),
    ).toBeChecked();
    await page.screenshot({
      path: info.outputPath(`anti-collision-${view.toLowerCase()}.png`),
      fullPage: false,
    });
  }
  await page
    .getByRole("button", { name: "Inspect calculation & report" })
    .click();
  const report = page.getByRole("dialog", { name: "Calculation audit report" });
  await expect(
    report.getByRole("heading", { name: "Candidate ledger" }),
  ).toBeVisible();
  await report.screenshot({ path: info.outputPath("calculation-report.png") });
  const download = page.waitForEvent("download");
  await report.getByRole("button", { name: "Export audit JSON" }).click();
  const file = await download;
  const exportPath = info.outputPath("collision-audit.json");
  await file.saveAs(exportPath);
  await page.getByRole("button", { name: "Close report" }).click();
  const fileChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import case / audit" }).click();
  await (await fileChooser).setFiles(exportPath);
  await expect(page.getByText(/Replay verified:/)).toBeVisible({
    timeout: 30000,
  });
  await page
    .getByRole("group", { name: "Preview view" })
    .getByRole("button", { name: "3-D", exact: true })
    .click();
  await expect
    .poll(() =>
      page
        .locator(".viz .chart")
        .evaluate(
          (e) =>
            (e as unknown as { data?: { type: string }[] }).data?.filter(
              (t) => t.type === "mesh3d",
            ).length ?? 0,
        ),
    )
    .toBeGreaterThan(0);
  expect(errors).toEqual([]);
  expect(
    requests.filter(
      (u) =>
        !u.startsWith(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173") &&
        !u.startsWith("data:") &&
        !u.startsWith("blob:"),
    ),
  ).toEqual([]);
  await info.attach("generation-latency", {
    body: JSON.stringify({ uiMs: latency }),
    contentType: "application/json",
  });
});

test("edits invalidate the correction and tight dogleg constraints return no path", async ({
  page,
  context,
}) => {
  await page.goto("./#workspace");
  await page
    .getByRole("button", { name: "Anti-collision", exact: true })
    .click();
  await page.getByRole("button", { name: "Load crossing demo" }).click();
  await expect(page.locator(".workflow-strip")).toContainText("DP-03");
  await page.getByRole("button", { name: "Use active hole & forecast" }).click();
  const generate = page.getByRole("button", {
    name: "Generate drill path",
    exact: true,
  });
  await expect(generate).toBeEnabled({ timeout: 30000 });
  await context.setOffline(true);
  await generate.click();
  await expect(page.getByLabel("Correction candidate")).toBeVisible();
  await page.getByLabel("Maximum dogleg", { exact: true }).fill("0.001");
  await expect(page.getByLabel("Correction candidate")).toHaveCount(0);
  await expect(generate).toBeEnabled();
  await generate.click();
  await expect(
    page.getByText("No candidate meets these constraints."),
  ).toBeVisible();
  await expect(page.getByLabel("Correction candidate")).toHaveCount(0);
  await page.getByLabel("Maximum dogleg", { exact: true }).fill("-1");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(generate).toBeDisabled();
});

test("saved collision runs reopen from the browser project and replay", async ({
  page,
}) => {
  await page.goto("./#workspace");
  await page
    .getByRole("button", { name: "Anti-collision", exact: true })
    .click();
  await page.getByRole("button", { name: "Load crossing demo" }).click();
  await expect(page.locator(".workflow-strip")).toContainText("DP-03");
  await page.getByRole("button", { name: "Use active hole & forecast" }).click();
  const generate = page.getByRole("button", {
    name: "Generate drill path",
    exact: true,
  });
  await expect(generate).toBeEnabled({ timeout: 30000 });
  await generate.click();
  await expect(page.getByLabel("Correction candidate")).toBeVisible();
  await page.getByText("Save, export & replay", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save run to project" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Save run to project" }).click();
  await expect(page.getByText(/Immutable evaluation run saved/)).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Anti-collision", exact: true })
    .click();
  await page.getByText("Save, export & replay", { exact: true }).click();
  await expect(page.getByLabel("Saved collision run")).toBeVisible();
  const id = await page
    .getByLabel("Saved collision run")
    .locator("option")
    .nth(1)
    .getAttribute("value");
  await page.getByLabel("Saved collision run").selectOption(id!);
  await page.getByRole("button", { name: "Replay saved run" }).click();
  await expect(page.getByText(/Replay verified:/)).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByLabel("Correction candidate")).toBeVisible();
});
