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

async function sendMessage(page: Page, text: string, waitMs = 20_000) {
  const input = page.getByTestId("chat-input");
  await input.fill(text);
  await input.press("Enter");
  await page.waitForTimeout(waitMs);
}

test.describe.configure({ mode: "serial" });

// ─── Save Note ──────────────────────────────────────────────────────────

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
    await sendMessage(page, "Hello");

    const aiMsg = page.getByTestId("chat-message").nth(1);
    await aiMsg.hover();
    await page.waitForTimeout(500);

    const saveNoteBtn = aiMsg.getByTestId("save-note-btn");
    await expect(saveNoteBtn).toBeVisible({ timeout: 3000 });
    await saveNoteBtn.click();
    await page.waitForTimeout(3000);

    await expect(saveNoteBtn).toContainText("Saved");
  });

  test("note appears in sidebar after saving", async ({ page }) => {
    const isAuthed = await waitForApp(page, 10_000);
    if (!isAuthed) {
      test.skip(true, "Requires authentication");
      return;
    }
    await selectFirstDocument(page);
    await sendMessage(page, "Hello sidebar note");

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

  test("saved note persists after page reload", async ({ page }) => {
    const isAuthed = await waitForApp(page, 10_000);
    if (!isAuthed) {
      test.skip(true, "Requires authentication");
      return;
    }
    await selectFirstDocument(page);
    await sendMessage(page, "Hello persist");

    const aiMsg = page.getByTestId("chat-message").nth(1);
    await aiMsg.hover();
    await page.waitForTimeout(500);

    const saveNoteBtn = aiMsg.getByTestId("save-note-btn");
    await saveNoteBtn.click();
    await page.waitForTimeout(3000);

    const sessionUrl = page.url();
    await page.goto(sessionUrl);
    await page.waitForTimeout(5000);

    // Note should still show in sidebar
    const notesSection = page.locator("text=/Saved Notes \\(1\\)/");
    await expect(notesSection).toBeVisible({ timeout: 3000 });

    // Button should still say "Saved"
    const msgAfterReload = page.getByTestId("chat-message").nth(1);
    await msgAfterReload.hover();
    await page.waitForTimeout(500);
    await expect(page.getByTestId("chat-message").nth(1).getByTestId("save-note-btn")).toContainText("Saved");
  });

  test("can remove a saved note", async ({ page }) => {
    const isAuthed = await waitForApp(page, 10_000);
    if (!isAuthed) {
      test.skip(true, "Requires authentication");
      return;
    }
    await selectFirstDocument(page);
    await sendMessage(page, "Hello remove");

    const aiMsg = page.getByTestId("chat-message").nth(1);
    await aiMsg.hover();
    await page.waitForTimeout(500);

    const saveNoteBtn = aiMsg.getByTestId("save-note-btn");
    await saveNoteBtn.click();
    await page.waitForTimeout(3000);

    // Remove the note
    await aiMsg.hover();
    await page.waitForTimeout(300);
    await saveNoteBtn.click();
    await page.waitForTimeout(2000);

    // Button should show "Save note" again
    await expect(saveNoteBtn).toContainText("Save note");
  });
});

// ─── Pin Note ───────────────────────────────────────────────────────────

test.describe("Pin Note", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/chat");
    await page.waitForTimeout(2000);
  });

  test("can pin a saved note", async ({ page }) => {
    const isAuthed = await waitForApp(page, 10_000);
    if (!isAuthed) {
      test.skip(true, "Requires authentication");
      return;
    }
    await selectFirstDocument(page);
    await sendMessage(page, "Hello pin");

    const aiMsg = page.getByTestId("chat-message").nth(1);
    await aiMsg.hover();
    await page.waitForTimeout(500);

    // Save note first
    const saveNoteBtn = aiMsg.getByTestId("save-note-btn");
    await saveNoteBtn.click();
    await page.waitForTimeout(3000);

    // Sidebar should show pinned section
    const pinnedSection = page.locator("text=/Pinned \\(1\\)/3\\)/");
    await expect(pinnedSection).toBeVisible({ timeout: 3000 });
  });

  test("pinned notes appear in pinned section below documents", async ({ page }) => {
    const isAuthed = await waitForApp(page, 10_000);
    if (!isAuthed) {
      test.skip(true, "Requires authentication");
      return;
    }
    await selectFirstDocument(page);
    await sendMessage(page, "Hello pinned section");

    const aiMsg = page.getByTestId("chat-message").nth(1);
    await aiMsg.hover();
    await page.waitForTimeout(500);

    const saveNoteBtn = aiMsg.getByTestId("save-note-btn");
    await saveNoteBtn.click();
    await page.waitForTimeout(3000);

    // Verify pinned section appears after documents section
    const docsSection = page.locator("text=/Documents/").first();
    const pinnedSection = page.locator("text=/Pinned/").first();
    const docsBox = await docsSection.boundingBox();
    const pinnedBox = await pinnedSection.boundingBox();
    expect(docsBox).not.toBeNull();
    expect(pinnedBox).not.toBeNull();
    // Pinned should be below documents (higher Y coordinate)
    expect(pinnedBox!.top).toBeGreaterThan(docsBox!.top);
  });

  test("pinned notes persist after reload", async ({ page }) => {
    const isAuthed = await waitForApp(page, 10_000);
    if (!isAuthed) {
      test.skip(true, "Requires authentication");
      return;
    }
    await selectFirstDocument(page);
    await sendMessage(page, "Hello pin persist");

    const aiMsg = page.getByTestId("chat-message").nth(1);
    await aiMsg.hover();
    await page.waitForTimeout(500);

    const saveNoteBtn = aiMsg.getByTestId("save-note-btn");
    await saveNoteBtn.click();
    await page.waitForTimeout(3000);

    const sessionUrl = page.url();
    await page.goto(sessionUrl);
    await page.waitForTimeout(5000);

    // Pinned section should still be visible
    const pinnedSection = page.locator("text=/Pinned \\(1\\)/3\\)/");
    await expect(pinnedSection).toBeVisible({ timeout: 3000 });
  });
});

// ─── Copy Message ───────────────────────────────────────────────────────

test.describe("Copy Message", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/chat");
    await page.waitForTimeout(2000);
  });

  test("copying AI message shows copied feedback", async ({ page }) => {
    const isAuthed = await waitForApp(page, 10_000);
    if (!isAuthed) {
      test.skip(true, "Requires authentication");
      return;
    }
    await selectFirstDocument(page);
    await sendMessage(page, "Hello copy");

    const aiMsg = page.getByTestId("chat-message").nth(1);
    await aiMsg.hover();
    await page.waitForTimeout(500);

    // Find and click the copy button
    const copyBtn = aiMsg.locator("button").filter({ hasText: /copy/i }).first();
    await expect(copyBtn).toBeVisible({ timeout: 3000 });
    await copyBtn.click();

    // Should show "Copied!" feedback
    await expect(aiMsg.locator("text=/copied/i")).toBeVisible({ timeout: 3000 });
  });
});

// ─── Image Upload ───────────────────────────────────────────────────────

test.describe("Image Upload", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/chat");
    await page.waitForTimeout(2000);
  });

  test("image persists after page reload", async ({ page }) => {
    const isAuthed = await waitForApp(page, 10_000);
    if (!isAuthed) {
      test.skip(true, "Requires authentication");
      return;
    }
    await selectFirstDocument(page);

    const imageInput = page.getByTestId("image-upload-input");
    await expect(imageInput).toBeAttached();
    await imageInput.setInputFiles("tests/test.png");
    await page.waitForTimeout(1000);

    const input = page.getByTestId("chat-input");
    await input.fill("Describe this image");
    await input.press("Enter");
    await page.waitForTimeout(20_000);

    const sessionUrl = page.url();
    await page.goto(sessionUrl);
    await page.waitForTimeout(5000);

    // Image should still be visible after reload
    const imageCount = await page.locator("img[src*='supabase'], img[src*='blob']").count();
    expect(imageCount).toBeGreaterThanOrEqual(1);
  });
});
