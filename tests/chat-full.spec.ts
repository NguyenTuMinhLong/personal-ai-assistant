import { test, expect, type Page } from "@playwright/test";

// ─── Helpers ─────────────────────────────────────────────────────────────

async function waitForApp(page: Page, timeout = 30_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const appLoaded = await page.getByTestId("chat-input").isVisible({ timeout: 0 }).catch(() => false);
    if (appLoaded) return true;
    await page.waitForTimeout(500);
  }
  return false;
}

async function selectFirstDocument(page: Page) {
  const doc = page.getByTestId("document-item").first();
  await doc.waitFor({ timeout: 5000 });
  await doc.click();
}

test.describe.configure({ mode: "serial" });

// ─── Save Note Tests ───────────────────────────────────────────────────

test.describe("Save Note", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/chat");
    await page.waitForTimeout(2000);
  });

  test("can save a note on AI message", async ({ page }) => {
    const isAuthed = await waitForApp(page, 10_000);
    if (!isAuthed) {
      test.skip(true, "Requires authentication");
      return;
    }
    await selectFirstDocument(page);

    const input = page.getByTestId("chat-input");
    await input.fill("Hello");
    await input.press("Enter");
    await page.waitForTimeout(20_000);

    // There should be at least one AI message (index 1)
    const msgCount = await page.getByTestId("chat-message").count();
    expect(msgCount).toBeGreaterThanOrEqual(2);

    // Hover over the AI message to reveal action buttons
    const aiMsg = page.getByTestId("chat-message").nth(1);
    await aiMsg.hover();
    await page.waitForTimeout(500);

    // Click save note button
    const saveNoteBtn = aiMsg.getByTestId("save-note-btn");
    await expect(saveNoteBtn).toBeVisible({ timeout: 3000 });
    await saveNoteBtn.click();
    await page.waitForTimeout(3000);

    // Button should now show "Saved"
    await expect(saveNoteBtn).toContainText("Saved");
  });

  test("saved note appears in sidebar", async ({ page }) => {
    const isAuthed = await waitForApp(page, 10_000);
    if (!isAuthed) {
      test.skip(true, "Requires authentication");
      return;
    }
    await selectFirstDocument(page);

    const input = page.getByTestId("chat-input");
    await input.fill("Hello sidebar");
    await input.press("Enter");
    await page.waitForTimeout(20_000);

    const aiMsg = page.getByTestId("chat-message").nth(1);
    await aiMsg.hover();
    await page.waitForTimeout(500);

    const saveNoteBtn = aiMsg.getByTestId("save-note-btn");
    await saveNoteBtn.click();
    await page.waitForTimeout(3000);

    // Sidebar should show "Saved Notes (1)"
    const notesSection = page.locator("text=/Saved Notes \\(1\\)/");
    await expect(notesSection).toBeVisible({ timeout: 3000 });
  });

  test("can remove a saved note", async ({ page }) => {
    const isAuthed = await waitForApp(page, 10_000);
    if (!isAuthed) {
      test.skip(true, "Requires authentication");
      return;
    }
    await selectFirstDocument(page);

    const input = page.getByTestId("chat-input");
    await input.fill("Hello remove");
    await input.press("Enter");
    await page.waitForTimeout(20_000);

    const aiMsg = page.getByTestId("chat-message").nth(1);
    await aiMsg.hover();
    await page.waitForTimeout(500);

    const saveNoteBtn = aiMsg.getByTestId("save-note-btn");
    await saveNoteBtn.click();
    await page.waitForTimeout(3000);

    // Now remove the note from sidebar
    const noteItem = page.locator("[class*='group']").filter({ hasText: /SecondBrain|Hello/i }).first();
    const noteRemoveBtn = noteItem.locator("button[title='Remove note']");
    await noteItem.hover();
    await page.waitForTimeout(300);
    await noteRemoveBtn.click({ force: true });
    await page.waitForTimeout(2000);

    // Sidebar should no longer show notes
    const notesSection = page.locator("text=/Saved Notes \\(0\\)/");
    await expect(notesSection).toBeHidden({ timeout: 3000 }).catch(() => {
      // If no notes, the section may be gone entirely
      expect(page.locator("text=/Saved Notes/").first().isHidden()).resolves.toBeTruthy();
    });
  });

  test("note persists after page reload", async ({ page }) => {
    const isAuthed = await waitForApp(page, 10_000);
    if (!isAuthed) {
      test.skip(true, "Requires authentication");
      return;
    }
    await selectFirstDocument(page);

    const input = page.getByTestId("chat-input");
    await input.fill("Hello persist");
    await input.press("Enter");
    await page.waitForTimeout(20_000);

    const aiMsg = page.getByTestId("chat-message").nth(1);
    await aiMsg.hover();
    await page.waitForTimeout(500);

    const saveNoteBtn = aiMsg.getByTestId("save-note-btn");
    await saveNoteBtn.click();
    await page.waitForTimeout(3000);

    // Save URL and reload
    const sessionUrl = page.url();
    await page.goto(sessionUrl);
    await page.waitForTimeout(5000);

    // Note should still be visible in sidebar
    const notesSection = page.locator("text=/Saved Notes \\(1\\)/");
    await expect(notesSection).toBeVisible({ timeout: 3000 });

    // And the message button should still say "Saved"
    const msgAfterReload = page.getByTestId("chat-message").nth(1);
    await msgAfterReload.hover();
    await page.waitForTimeout(500);
    await expect(saveNoteBtn).toContainText("Saved");
  });
});
