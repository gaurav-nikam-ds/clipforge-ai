import { test, expect } from "@playwright/test";

test("home loads and primary navigation changes pages", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/ClipForge AI Studio/i);
  await expect(page.getByRole("heading", { name: /Make your next video/i })).toBeVisible();

  await page.getByRole("button", { name: /Video editor/i }).first().click();
  await expect(page.locator("#page-editor")).toHaveClass(/active/);
  await expect(page.locator("#page-editor h1")).toHaveText(/Video editor/i);

  await page.getByRole("button", { name: /Export & settings/i }).click();
  await expect(page.locator("#page-export")).toHaveClass(/active/);
});

test("editor exposes local media upload and caption controls", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Video editor/i }).first().click();

  await expect(page.locator("#videoFile")).toHaveAttribute("type", "file");
  await expect(page.locator("#captionList")).toBeVisible();
  await expect(page.locator("#addCaption")).toBeVisible();
  await expect(page.locator("#cfTranscribe")).toBeVisible();
  await expect(page.locator("#cfDetectSilence")).toBeVisible();
  await expect(page.locator("#cfSplitVideo")).toBeVisible();
});

test("caption editor can add a caption without a media file", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Video editor/i }).first().click();
  await page.locator("#addCaption").click();
  await expect(page.locator("#captionList .caption-item")).toHaveCount(1);
});

test("export page discloses WebM browser export", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Export & settings/i }).click();
  await expect(page.locator("#page-export")).toBeVisible();
  await expect(page.locator("#page-export")).toContainText(/WebM/i);
});
