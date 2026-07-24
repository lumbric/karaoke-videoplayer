import { expect, test } from "@playwright/test";

test("loads home screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByPlaceholder("Songs suchen...")).toBeVisible();
});
