import { expect, test } from "@playwright/test";

test("Oregon calculates, dual-lateral overlays, and IndexedDB survives refresh", async ({ page }) => {
  await page.goto("/#workspace");
  await page.getByRole("button", { name: "Oregon example" }).click();
  await expect(page.getByText("Calculated (Minimum Curvature).").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".kv b").first()).toHaveText("2,591.00");
  await expect(page.locator(".kv b").nth(3)).toHaveText("2,301.36");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.").first()).toBeVisible({ timeout: 10_000 });

  await page.reload();
  await expect(page.getByText(/Reopened local browser project|Calculated \(Minimum Curvature\)/).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator(".kv b").first()).toHaveText("2,591.00", { timeout: 15_000 });
  await expect(page.locator(".kv b").nth(3)).toHaveText("2,301.36");

  await page.getByRole("button", { name: "Load dual-lateral example" }).click();
  await expect(page.getByText(/SYNTHETIC dual-lateral loaded/).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("select").filter({ hasText: "Lateral B" })).toBeVisible();
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForTimeout(500);

  await page.reload();
  await expect(page.locator("select").filter({ hasText: "Lateral B" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("option", { name: /Parent wellbore/ })).toBeAttached();
});
