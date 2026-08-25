import { expect, test } from "@playwright/test";

test("Oregon demo calculates and shows safety credit", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Directional survey calculation/i })).toBeVisible();
  await expect(page.getByText(/Created by Philip Bird — Mithril Consulting/).first()).toBeVisible();
  await expect(page.getByText(/not certified/i).first()).toBeVisible();
  await expect(page.locator(".kv b").first()).not.toHaveText("—", { timeout: 20_000 });
  await page.getByRole("button", { name: "Oregon example" }).click();
  await expect(page.getByText("Calculated (Minimum Curvature).").first()).toBeVisible({ timeout: 15_000 });
});

test("dual-lateral overlays and projections stay labelled", async ({ page }) => {
  await page.goto("/#workspace");
  await page.getByRole("button", { name: "Load dual-lateral example" }).click();
  await expect(page.getByText(/SYNTHETIC dual-lateral loaded/).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("select").filter({ hasText: "Lateral B" })).toBeVisible();
  await page.locator(".proj-bar select").selectOption("md");
  await expect(page.getByText("PROJECTED").first()).toBeVisible({ timeout: 10_000 });
});

test("source and Mithril links are safe", async ({ page }) => {
  await page.goto("/");
  const source = page.getByRole("navigation", { name: "DelvePath" }).getByRole("link", { name: "Source" });
  await expect(source).toHaveAttribute("href", /https:\/\//);
  await expect(source).toHaveAttribute("rel", /noopener/);
  const mithril = page.getByRole("navigation", { name: "DelvePath" }).getByRole("link", { name: "Mithril Consulting" });
  await expect(mithril).toHaveAttribute("href", "https://mithrilconsulting.io");
  const download = page.getByRole("navigation", { name: "DelvePath" }).getByRole("link", { name: "Windows Download" });
  await expect(download).toHaveAttribute(
    "href",
    "https://drive.google.com/drive/folders/1nnhXHkcPL2cjl5L7wZVUMPQnb6cnc3_d?usp=sharing"
  );
  await expect(download).toHaveAttribute("rel", /noopener/);
  await expect(download).toHaveAttribute("target", "_blank");
});
