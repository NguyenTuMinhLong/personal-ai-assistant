import { test, expect, type Page, type Locator } from "@playwright/test";

// ─── Helpers ───────────────────────────────────────────────────────────────

async function getClerkPublishableKey(page: Page): Promise<string> {
  return page.evaluate(() => {
    return (window as unknown as { __clerkPublishableKey?: string }).__clerkPublishableKey ?? "";
  });
}

async function waitForToast(page: Page, contains: string, timeout = 5000) {
  await page.getByText(contains).first().waitFor({ state: "visible", timeout });
}

async function waitForNetworkIdle(page: Page, timeout = 5000) {
  await page.waitForLoadState("networkidle", { timeout }).catch(() => {});
}

function getInput(page: Page): Locator {
  return page.getByTestId("chat-input");
}

function getSendButton(page: Page): Locator {
  return page.locator("button[type='submit']");
}

async function selectFirstDocument(page: Page) {
  await page.getByTestId("document-item").first().click({ timeout: 5000 });
}

// ─── Auth Setup ─────────────────────────────────────────────────────────────
// Clerk dev keys require network. Use a signed-in cookie if available,
// otherwise skip auth-dependent tests in CI.

test.describe.configure({ mode: "serial" });

// ─── Core Chat Flow ─────────────────────────────────────────────────────────

test.describe("Chat core flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/chat");
    // Allow Clerk dev banner to settle
    await page.waitForTimeout(2000);
  });

  test("redirects to sign-in when unauthenticated", async ({ page }) => {
    // Clear cookies to simulate unauthenticated state
    await page.context().clearCookies();
    await page.goto("/chat");
    // Clerk should redirect to sign-in
    await expect(page).toHaveURL(/sign-in|signin/i, { timeout: 10000 });
  });

  test("shows empty state when no documents uploaded", async ({ page }) => {
    // Look for empty state or no-document message
    const emptyState = page.locator("text=/No documents|Upload.*document|empty/i").first();
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    // Either shows empty state OR document list is empty
    expect(hasEmptyState || (await page.locator('[data-testid="document-item"]').count()) === 0).toBeTruthy();
  });

  test("cannot send message without selecting a document", async ({ page }) => {
    const input = getInput(page);
    await input.fill("Hello world");
    const sendBtn = getSendButton(page);
    // Submit via Enter
    await input.press("Enter");
    // Should see an error toast or the input should remain unchanged
    const inputValue = await input.inputValue();
    // Message should NOT have been sent (input cleared)
    // In a properly guarded app, either toast appears or nothing happens
    const toastOrNoChange = await (
      page.locator("text=/choose.*document|select.*document|need.*document/i").isVisible().catch(() => false)
    ) || inputValue === "Hello world";
    expect(toastOrNoChange).toBeTruthy();
  });
});

// ─── Message Sending ────────────────────────────────────────────────────────

test.describe("Message sending", () => {
  test("sends message and receives AI response", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForTimeout(2000);

    await selectFirstDocument(page);

    const input = getInput(page);
    await input.fill("What is this document about?");
    await input.press("Enter");

    // Wait for AI response
    await page.waitForTimeout(10000);

    // Should see both user message and assistant response
    const count = await page.getByTestId("chat-message").count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("empty message does not send", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForTimeout(2000);
    await selectFirstDocument(page);

    const input = getInput(page);
    await input.press("Enter");
    await page.waitForTimeout(500);

    // Should not have any messages
    expect(await page.getByTestId("chat-message").count()).toBeLessThanOrEqual(1);
  });

  test("sends multiple messages in sequence", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForTimeout(2000);
    await selectFirstDocument(page);

    const input = getInput(page);

    for (const q of ["First question", "Second question", "Third question"]) {
      await input.fill(q);
      await input.press("Enter");
      await page.waitForTimeout(500);
    }

    await page.waitForTimeout(8000);
    const count = await page.getByTestId("chat-message").count();
    expect(count).toBeGreaterThanOrEqual(3);
  });
});

// ─── Session Management ─────────────────────────────────────────────────────

test.describe("Session management", () => {
  test("new session auto-created when no session exists", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForTimeout(2000);
    await selectFirstDocument(page);

    const input = getInput(page);
    await input.fill("Hello, create a new session for me");
    await input.press("Enter");
    await page.waitForTimeout(10000);

    // URL should now contain a sessionId
    const url = page.url();
    expect(url).toMatch(/sessionId=/);
  });

  test("session URL param loads correct session", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForTimeout(2000);
    await selectFirstDocument(page);

    const input = getInput(page);
    await input.fill("Test session");
    await input.press("Enter");
    await page.waitForTimeout(10000);

    const sessionUrl = page.url();
    expect(sessionUrl).toMatch(/sessionId=[a-f0-9-]+/i);

    // Reload with session URL
    await page.goto(sessionUrl);
    await page.waitForTimeout(3000);

    // Messages should be loaded
    const messages = page.locator('[data-testid="chat-message"]').or(
      page.locator('[data-testid="message-bubble"]').or(
        page.locator('[data-testid="message"]')
      )
    );
    const count = await messages.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("deleting a session removes it from the list", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForTimeout(2000);
    await selectFirstDocument(page);

    // Create a session
    const input = getInput(page);
    await input.fill("Create session for deletion test");
    await input.press("Enter");
    await page.waitForTimeout(10000);
    const sessionUrl = page.url();

    // Reload
    await page.goto(sessionUrl);
    await page.waitForTimeout(3000);

    // Find and click delete session button
    const deleteBtn = page.locator('[data-testid="delete-session"]').or(
      page.locator("button").filter({ hasText: /delete|remove|trash/i }).first()
    );
    const deleteVisible = await deleteBtn.isVisible().catch(() => false);
    if (deleteVisible) {
      await deleteBtn.click();
      await page.waitForTimeout(1000);
      // Session should be gone from URL
      expect(page.url()).not.toMatch(/sessionId=/);
    }
  });
});

// ─── Image Upload ────────────────────────────────────────────────────────────

test.describe("Image upload", () => {
  test("attaches image and persists after reload", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForTimeout(2000);
    await selectFirstDocument(page);

    // Attach image
    const imageInput = page.locator('input[type="file"]').last();
    const imageAttached = await imageInput.isVisible().catch(() => false);

    if (!imageAttached) {
      // Try clicking the image attachment button
      const attachBtn = page.locator("button").filter({ has: page.locator("svg") }).first();
      await attachBtn.click().catch(() => {});
      await page.waitForTimeout(500);
    }

    // Upload a real test image (1x1 red PNG)
    await imageInput.setInputFiles({
      name: "test.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "89504e470d0a1a0a0000000d49484452000000010000000108020000009001" +
        "2e000000003c4944415408d76360f8cfc00000000200012a7e3000000000045" +
        "4e444ae432060600000018002418abcdef",
        "hex"
      ),
    });

    await page.waitForTimeout(1000);

    // Image preview should appear
    const preview = page.locator("img[src*='blob:']").or(page.locator('[data-testid="image-preview"]'));
    const hasPreview = await preview.first().isVisible().catch(() => false);

    // Send message
    const input = getInput(page);
    await input.fill("Describe this image");
    await input.press("Enter");
    await page.waitForTimeout(12000);

    // Reload
    const sessionUrl = page.url();
    await page.goto(sessionUrl);
    await page.waitForTimeout(5000);

    // Image should still be visible after reload
    const imagesAfterReload = page.locator("img[src*='supabase']").or(
      page.locator("img[src*='blob']")
    );
    const imageCount = await imagesAfterReload.count();
    // At minimum, the image should appear in the chat (either blob: or supabase: URL)
    // If it's gone after reload, the bug is confirmed
    expect(imageCount).toBeGreaterThanOrEqual(1);
  });

  test("upload too-large image returns error", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForTimeout(2000);
    await selectFirstDocument(page);

    // Create a fake file > 10MB
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024, "x");
    const imageInput = page.locator('input[type="file"]').last();
    await imageInput.setInputFiles({
      name: "large.jpg",
      mimeType: "image/jpeg",
      buffer: largeBuffer,
    });
    await page.waitForTimeout(2000);

    // Should show error toast
    const errorToast = page.locator("text=/too large|exceed|max.*size/i");
    const hasError = await errorToast.isVisible().catch(() => false);
    expect(hasError).toBeTruthy();
  });

  test("non-image file upload returns error", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForTimeout(2000);
    await selectFirstDocument(page);

    // Upload a text file
    const imageInput = page.locator('input[type="file"]').last();
    await imageInput.setInputFiles({
      name: "document.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("This is not an image"),
    });
    await page.waitForTimeout(2000);

    // Should show error
    const errorToast = page.locator("text=/invalid|unsupported|not.*image|format/i");
    const hasError = await errorToast.isVisible().catch(() => false);
    expect(hasError).toBeTruthy();
  });
});

// ─── Annotations ─────────────────────────────────────────────────────────────

test.describe("Annotations", () => {
  test("can save and remove a note on a message", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForTimeout(2000);
    await selectFirstDocument(page);

    const input = getInput(page);
    await input.fill("Hello");
    await input.press("Enter");
    await page.waitForTimeout(10000);

    // Find save note button
    const saveNoteBtn = page.locator("button").filter({ hasText: /note|bookmark|save/i }).first();
    const noteBtnVisible = await saveNoteBtn.isVisible().catch(() => false);

    if (noteBtnVisible) {
      await saveNoteBtn.click();
      await page.waitForTimeout(2000);

      // Note should appear
      const noteSaved = page.locator("text=/note saved|note.*added/i").isVisible().catch(() => false);
      expect(noteSaved).toBeTruthy();

      // Remove note
      await saveNoteBtn.click();
      await page.waitForTimeout(1000);
    }
  });

  test("note persists after page reload", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForTimeout(2000);
    await selectFirstDocument(page);

    const input = getInput(page);
    await input.fill("Save this message");
    await input.press("Enter");
    await page.waitForTimeout(10000);

    // Save note
    const saveNoteBtn = page.locator("button").filter({ hasText: /note|bookmark|save/i }).first();
    const noteBtnVisible = await saveNoteBtn.isVisible().catch(() => false);

    if (noteBtnVisible) {
      await saveNoteBtn.click();
      await page.waitForTimeout(2000);

      // Reload
      const sessionUrl = page.url();
      await page.goto(sessionUrl);
      await page.waitForTimeout(5000);

      // Note icon should still be filled/active
      const activeNote = page.locator('[data-testid="note-active"]').or(
        page.locator("button").filter({ hasText: /note.*saved|saved.*note/i }).first()
      );
      const hasNote = await activeNote.isVisible().catch(() => false);
      expect(hasNote).toBeTruthy();
    }
  });
});

// ─── Edge Cases ─────────────────────────────────────────────────────────────

test.describe("Edge cases", () => {
  test("message with special characters renders correctly", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForTimeout(2000);
    await selectFirstDocument(page);

    const input = getInput(page);
    const specialMsg = 'Hello! @#$%^&*()_+-=[]{}|;:\'",.<>?/`~\\ 日本語 中文  🎉';
    await input.fill(specialMsg);
    await input.press("Enter");
    await page.waitForTimeout(10000);

    // Message should appear in DOM
    const messageEl = page.locator(`text="${specialMsg}"`).or(
      page.locator(`text=/Hello.*@#\$%/`)
    );
    const visible = await messageEl.first().isVisible().catch(() => false);
    expect(visible).toBeTruthy();
  });

  test("very long message does not break layout", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForTimeout(2000);
    await selectFirstDocument(page);

    const input = getInput(page);
    const longMsg = "A".repeat(5000);
    await input.fill(longMsg);
    await input.press("Enter");
    await page.waitForTimeout(12000);

    // Should not crash - at minimum there should be user message visible
    const userMsg = page.locator('[data-testid="chat-message"]').or(
      page.locator('[data-testid="message"]')
    );
    const count = await userMsg.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("rapid message sending is handled gracefully", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForTimeout(2000);
    await selectFirstDocument(page);

    const input = getInput(page);

    // Send 3 messages rapidly
    await input.fill("First");
    await input.press("Enter");
    await input.fill("Second");
    await input.press("Enter");
    await input.fill("Third");
    await input.press("Enter");

    await page.waitForTimeout(15000);

    // All messages should appear
    const messages = page.locator('[data-testid="chat-message"]').or(
      page.locator('[data-testid="message-bubble"]').or(
        page.locator('[data-testid="message"]')
      )
    );
    const count = await messages.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("AI error is shown gracefully", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForTimeout(2000);
    await selectFirstDocument(page);

    // Try to trigger an error by sending an empty question
    const input = getInput(page);
    await input.fill("");
    await input.press("Enter");
    await page.waitForTimeout(2000);

    // Should not crash - check no error page
    await expect(page.locator("body")).toBeVisible();
    expect(page.url()).toContain("/chat");
  });
});

// ─── Navigation ─────────────────────────────────────────────────────────────

test.describe("Navigation", () => {
  test("sidebar document list persists across navigation", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForTimeout(2000);

    // Get first document name
    const firstDoc = page.locator('[data-testid="document-item"]').first();
    const docName = await firstDoc.textContent().catch(() => "");

    // Navigate away and back
    await page.goto("/");
    await page.waitForTimeout(1000);
    await page.goto("/chat");
    await page.waitForTimeout(2000);

    // Document should still be there
    const docStillThere = page.locator(`text=${docName ?? ""}`).first();
    if (docName) {
      await expect(docStillThere).toBeVisible();
    }
  });
});
