import { test, expect } from "@playwright/test";

const SAMPLE_JSON_DATA = `[
  {"id": 1, "customer": "Alice Chen", "status": "Shipped", "total": 120},
  {"id": 2, "customer": "Bob Ramos", "status": "Pending", "total": 80},
  {"id": 3, "customer": "Charlie Miller", "status": "Shipped", "total": 150},
  {"id": 4, "customer": "Diana Prince", "status": "Processing", "total": 200},
  {"id": 5, "customer": "Ethan Hunt", "status": "Cancelled", "total": 50}
]`;

async function createAndPopulateBlob(page: any) {
  // Wait for sidebar/blobs to load to prevent hydration race conditions
  await expect(page.locator(".blob-item").first()).toBeVisible();

  // Click "+ New blob"
  const newBlobBtn = page.locator("#new-blob-btn");
  await expect(newBlobBtn).toBeVisible();
  await newBlobBtn.click();

  // Populate editor with our structured sample dataset
  const editor = page.locator(".cm-content");
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await editor.fill(SAMPLE_JSON_DATA);
}

test.describe("NexBlob E2E Flow", () => {
  test("should detect invalid JSON, show error, and resolve when corrected", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Wait for the database/blobs to load in the sidebar to avoid race conditions
    await expect(page.locator(".blob-item").first()).toBeVisible();

    // Click "+ New blob" to get a clean editor state
    const newBlobBtn = page.locator("#new-blob-btn");
    await newBlobBtn.click();

    const editor = page.locator(".cm-content");
    await expect(editor).toBeVisible();

    // 1. Enter invalid JSON
    await editor.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    await editor.fill('{"name": "NexBlob", "invalid": ');

    // 2. Check that the error state is displayed in the UI
    const statusBadge = page.locator(".breadcrumb .badge");
    await expect(statusBadge).toHaveText("error");
    await expect(statusBadge).toHaveClass(/badge-warning/);

    const errorDisplay = page.locator("text=Unexpected end of JSON").first();
    await expect(errorDisplay).toBeVisible();

    // 3. Correct the JSON to be valid
    await editor.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    await editor.fill('{"name": "NexBlob", "valid": true}');

    // 4. Verify that the error is resolved and status becomes valid
    await expect(statusBadge).toHaveText("valid");
    await expect(statusBadge).toHaveClass(/badge-success/);
    await expect(errorDisplay).not.toBeVisible();
    
    const treeViewKey = page.locator("text=name").first();
    await expect(treeViewKey).toBeVisible();
  });

  test("should handle user authentication flow using dev backdoor", async ({ page }) => {
    // 1. Verify unauthenticated UI state
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const loginBtn = page.locator("#google-login-btn");
    await expect(loginBtn).toBeVisible();
    await expect(page.locator("#save-blob-btn")).not.toBeVisible();
    await expect(page.locator("#share-blob-btn")).not.toBeVisible();

    // 2. Log in using the backdoor route
    await page.goto("/api/auth/dev-login?email=e2e@test.com&name=E2E+Tester");
    await page.waitForLoadState("networkidle");
    
    // Verify it redirects back to root path
    await expect(page).toHaveURL("/");

    // 3. Verify authenticated UI state shows save/share/signout options
    await expect(loginBtn).not.toBeVisible();
    await expect(page.locator("#save-blob-btn")).toBeVisible();
    await expect(page.locator("#share-blob-btn")).toBeVisible();
    await expect(page.locator("text=Sign Out")).toBeVisible();
  });

  test("should handle creating, renaming, and saving a new blob", async ({ page }) => {
    await page.goto("/api/auth/dev-login?email=e2e@test.com&name=E2E+Tester");
    await page.waitForLoadState("networkidle");

    // Wait for the database/blobs to load in the sidebar to avoid race conditions
    await expect(page.locator(".blob-item").first()).toBeVisible();

    // 1. Click "+ New blob"
    await page.locator("#new-blob-btn").click();

    // 2. Clear editor and fill with unique JSON content
    const editor = page.locator(".cm-content");
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    const uniqueVal = `e2e_val_${Math.floor(Math.random() * 1000000)}`;
    await editor.fill(`{"test_key": "${uniqueVal}"}`);

    // 3. Rename the blob in the breadcrumbs
    const nameDisplay = page.locator("#blob-name-display");
    await expect(nameDisplay).toBeVisible();
    await nameDisplay.click();

    // Fill the rename input field
    const nameInput = page.locator("#blob-name-input");
    await expect(nameInput).toBeVisible();
    await nameInput.fill(`E2E Saved Blob ${uniqueVal}`);
    await page.keyboard.press("Enter");

    // 4. Click Save button
    const saveBtn = page.locator("#save-blob-btn");
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Verify it shows "Saved! ✓" on the screen
    await expect(page.locator("text=Saved! ✓")).toBeVisible();

    // 5. Verify the newly saved blob appears in the sidebar list
    const sidebarItem = page.locator(".file-sidebar").locator(`text=E2E Saved Blob ${uniqueVal}`);
    await expect(sidebarItem).toBeVisible();
  });

  test("should ask AI for a SQL query, extract it, switch to SQL view, and execute it", async ({ page }) => {
    test.setTimeout(60000); // 60s timeout for AI response
    await page.goto("/api/auth/dev-login?email=e2e@test.com&name=E2E+Tester");
    await page.waitForLoadState("networkidle");

    // Create and populate a clean sample data blob
    await createAndPopulateBlob(page);

    // 1. Navigate to AI Specialist tab
    const aiTab = page.locator("#view-pill-ai_page");
    await expect(aiTab).toBeVisible();
    await aiTab.click();

    // 2. Ask AI for a query referencing our JSON data. Warning against the 'total' keyword.
    const chatInput = page.locator("#ai-chat-input");
    await expect(chatInput).toBeVisible();
    await chatInput.fill("Write a SQLite query selecting customer and status from the JSON array using a question mark table placeholder: SELECT customer, status FROM ?. Do not use the word 'total' in the query.");
    
    const sendBtn = page.locator("#ai-send-btn");
    await sendBtn.click();

    // Wait for the AI's response to complete and output a code block
    const codeBlock = page.locator("pre code").first();
    await expect(codeBlock).toBeVisible({ timeout: 50000 });
    
    const queryText = await codeBlock.innerText();
    console.log("AI GENERATED QUERY:", queryText);
    expect(queryText).toContain("SELECT");

    // 3. Switch to SQL View
    const sqlTab = page.locator("#view-pill-sql");
    await sqlTab.click();

    // 4. Enter the AI-generated SQL query in the editor
    const sqlInput = page.locator("#sql-query-input");
    await expect(sqlInput).toBeVisible();
    await sqlInput.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    await sqlInput.fill(queryText.trim());

    // 5. Click Run Query and verify output table
    const runBtn = page.locator("#run-sql-btn");
    await runBtn.click();

    const resultsTable = page.locator(".data-table");
    await expect(resultsTable).toBeVisible();
    
    // Check that we have header or cell elements in the results
    const tableHeader = page.locator(".data-table th");
    await expect(tableHeader.first()).toBeVisible();
  });

  test("should handle adding and deleting a D1 database connection", async ({ page }) => {
    await page.goto("/api/auth/dev-login?email=e2e@test.com&name=E2E+Tester");
    await page.waitForLoadState("networkidle");

    // 1. Click "+ Connect database"
    const connectBtn = page.locator("#connect-table-btn");
    await expect(connectBtn).toBeVisible();
    await connectBtn.click();

    // 2. Fill the modal form
    await page.getByPlaceholder("e.g. My Prod Analytics").fill("E2E Test DB");
    await page.getByPlaceholder("Hex Account ID").fill("1234567890abcdef1234567890abcdef");
    await page.getByPlaceholder("UUID Database ID").fill("12345678-1234-1234-1234-123456789012");
    await page.getByPlaceholder("API Token (Read/Write D1)").fill("my_mock_api_token");

    // Click Connect submit button inside the modal
    await page.locator('.modal-container button[type="submit"]').click();

    // 3. Verify it appears in the sidebar under connected D1 databases
    const connectionHeader = page.locator('text=E2E Test DB');
    await expect(connectionHeader).toBeVisible();

    // 4. Disconnect/delete the connection
    // We mock dialog confirmation using page.on('dialog')
    page.on("dialog", async (dialog) => {
      expect(dialog.message()).toContain("disconnect E2E Test DB");
      await dialog.accept();
    });

    const deleteBtn = page.locator(".conn-delete-btn").first();
    await deleteBtn.click();

    // 5. Verify connection header is removed
    await expect(connectionHeader).not.toBeVisible();
  });

  test("should allow comparing JSON documents in Diff view", async ({ page }) => {
    await page.goto("/api/auth/dev-login?email=e2e@test.com&name=E2E+Tester");
    await page.waitForLoadState("networkidle");

    // Create and populate a clean sample data blob
    await createAndPopulateBlob(page);

    // Switch to the Diff view tab
    const diffTab = page.locator("#view-pill-diff");
    await expect(diffTab).toBeVisible();
    await diffTab.click();

    // Verify the initial input view is loaded
    await expect(page.locator("text=JSON Diff Checker")).toBeVisible();

    // Fill in some JSON to compare against
    const compareInput = page.locator("#diff-compare-input");
    await expect(compareInput).toBeVisible();
    await compareInput.fill('{"name": "NexBlob", "valid": false}');

    // Click the Compare button
    const compareBtn = page.locator("#diff-compare-btn");
    await expect(compareBtn).toBeVisible();
    await compareBtn.click();

    // Verify the comparison view is loaded and shows Original and Modified panels
    await expect(page.locator("text=Original JSON (A)")).toBeVisible();
    await expect(page.locator("text=Modified JSON (B)")).toBeVisible();
  });

  test("should allow navigating the JSON Tree View interactive nodes", async ({ page }) => {
    await page.goto("/api/auth/dev-login?email=e2e@test.com&name=E2E+Tester");
    await page.waitForLoadState("networkidle");

    // Create and populate a clean sample data blob
    await createAndPopulateBlob(page);

    // Ensure we are in the Editor tab
    const editorTab = page.locator("#view-pill-editor");
    await expect(editorTab).toBeVisible();
    await editorTab.click();

    // Find the first index node [0] in Tree view
    const firstNode = page.locator("text=[0]").first();
    await expect(firstNode).toBeVisible();
    await firstNode.click();

    // Verify selected path is updated and shown at the top of the Tree view
    const selectedPathDisplay = page.locator("text=$[0]").first();
    await expect(selectedPathDisplay).toBeVisible();
  });

  test("should allow searching, sorting, and filtering table rows in Table view", async ({ page }) => {
    await page.goto("/api/auth/dev-login?email=e2e@test.com&name=E2E+Tester");
    await page.waitForLoadState("networkidle");

    // Create and populate a clean sample data blob
    await createAndPopulateBlob(page);

    // Switch to Table View tab
    const tableTab = page.locator("#view-pill-table");
    await expect(tableTab).toBeVisible();
    await tableTab.click();

    // Verify rows count label is visible (e.g. 5 / 5 rows)
    const countLabel = page.locator("text=5 / 5 rows");
    await expect(countLabel).toBeVisible();

    // Filter table by typing "Alice"
    const filterInput = page.locator("#table-filter");
    await expect(filterInput).toBeVisible();
    await filterInput.fill("Alice");

    // Verify row count updates to "1 / 5 rows"
    const filteredCountLabel = page.locator("text=1 / 5 rows");
    await expect(filteredCountLabel).toBeVisible();

    // Verify Alice is shown in the table, but Bob is not
    await expect(page.locator(".data-table").locator("text=Alice Chen")).toBeVisible();
    await expect(page.locator(".data-table").locator("text=Bob Ramos")).not.toBeVisible();

    // Clear filter
    await filterInput.fill("");
    await expect(countLabel).toBeVisible();
  });

  test("should support minifying and formatting JSON content in Raw view", async ({ page }) => {
    await page.goto("/api/auth/dev-login?email=e2e@test.com&name=E2E+Tester");
    await page.waitForLoadState("networkidle");

    // Create and populate a clean sample data blob
    await createAndPopulateBlob(page);

    // Switch to Raw View tab
    const rawTab = page.locator("#view-pill-raw");
    await expect(rawTab).toBeVisible();
    await rawTab.click();

    // Verify copy button is visible
    await expect(page.locator("#copy-raw-btn")).toBeVisible();

    // Switch to minified mode
    const minifiedBtn = page.locator("#raw-mode-minified");
    await expect(minifiedBtn).toBeVisible();
    await minifiedBtn.click();

    // Verify it minified (should have no indents)
    const rawTextElement = page.locator("pre").first();
    const rawText = await rawTextElement.innerText();
    expect(rawText).not.toContain("\n ");

    // Switch back to formatted mode
    const formattedBtn = page.locator("#raw-mode-formatted");
    await expect(formattedBtn).toBeVisible();
    await formattedBtn.click();

    const formattedText = await rawTextElement.innerText();
    expect(formattedText).toContain("\n  ");
  });

  test("should display metrics and switch chart rendering modes in Chart view", async ({ page }) => {
    await page.goto("/api/auth/dev-login?email=e2e@test.com&name=E2E+Tester");
    await page.waitForLoadState("networkidle");

    // Create and populate a clean sample data blob
    await createAndPopulateBlob(page);

    // Switch to Charts view tab
    const chartTab = page.locator("#view-pill-chart");
    await expect(chartTab).toBeVisible();
    await chartTab.click();

    // Verify metric cards are rendered (using exact match to avoid strict mode violations with lowercase editor keys or option values)
    await expect(page.getByText("Total", { exact: true })).toBeVisible();
    await expect(page.getByText("Max", { exact: true })).toBeVisible();
    await expect(page.getByText("Count", { exact: true })).toBeVisible();

    // Switch chart to Line type
    const lineChartBtn = page.locator("#chart-type-line");
    await expect(lineChartBtn).toBeVisible();
    await lineChartBtn.click();
    
    // Line chart SVG component check
    const lineChartSvg = page.locator(".recharts-line");
    await expect(lineChartSvg).toBeVisible();

    // Switch chart to Pie type
    const pieChartBtn = page.locator("#chart-type-pie");
    await expect(pieChartBtn).toBeVisible();
    await pieChartBtn.click();

    const pieChartSvg = page.locator(".recharts-pie");
    await expect(pieChartSvg).toBeVisible();
  });

  test("should integrate Explain with AI status bar action", async ({ page }) => {
    await page.goto("/api/auth/dev-login?email=e2e@test.com&name=E2E+Tester");
    await page.waitForLoadState("networkidle");

    // Create and populate a clean sample data blob
    await createAndPopulateBlob(page);

    // Click the explain chip in the status bar
    const explainChip = page.locator("#explain-chip");
    await expect(explainChip).toBeVisible();
    await explainChip.click();

    // Verify it automatically navigates to the AI Specialist view
    const aiTab = page.locator("#view-pill-ai_page");
    await expect(aiTab).toHaveClass(/active/);

    // Verify AI Chat container shows chat input
    const chatInput = page.locator("#ai-chat-input");
    await expect(chatInput).toBeVisible();
  });

  test("should allow running a SQL query and saving query results as a new JSON Blob", async ({ page }) => {
    await page.goto("/api/auth/dev-login?email=e2e@test.com&name=E2E+Tester");
    await page.waitForLoadState("networkidle");

    // Create and populate a clean sample data blob
    await createAndPopulateBlob(page);

    // Switch to SQL View tab
    const sqlTab = page.locator("#view-pill-sql");
    await expect(sqlTab).toBeVisible();
    await sqlTab.click();

    // Enter a SQL query
    const sqlInput = page.locator("#sql-query-input");
    await expect(sqlInput).toBeVisible();
    await sqlInput.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    await sqlInput.fill("SELECT customer, status FROM ? WHERE status = 'Shipped'");

    // Run query
    const runBtn = page.locator("#run-sql-btn");
    await runBtn.click();

    // Verify Save as JSON Blob button is displayed
    const saveBlobBtn = page.locator("#save-query-as-blob-btn");
    await expect(saveBlobBtn).toBeVisible({ timeout: 5000 });
    await saveBlobBtn.click();

    // Verify it switched back to editor view and populated content with query results
    const editorTab = page.locator("#view-pill-editor");
    await expect(editorTab).toHaveClass(/active/);

    const editorContent = page.locator(".cm-content");
    await expect(editorContent).toBeVisible();
    const text = await editorContent.innerText();
    expect(text).toContain("Alice Chen");
    expect(text).toContain("Shipped");
    expect(text).not.toContain("Bob Ramos");
  });

  test("should allow sharing a JSON blob and opening the shared URL to view full JSON content", async ({ page, context, browser }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/api/auth/dev-login?email=e2e@test.com&name=E2E+Tester");
    await page.waitForLoadState("networkidle");

    // Create and populate a clean sample data blob
    await createAndPopulateBlob(page);

    // Save the blob first
    const saveBtn = page.locator("#save-blob-btn");
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Click Share button
    const shareBtn = page.locator("#share-blob-btn");
    await expect(shareBtn).toBeVisible();
    await shareBtn.click();

    // Retrieve active blob ID from sidebar to construct shared URL reliably
    const activeItem = page.locator(".blob-item.active");
    await expect(activeItem).toBeVisible();

    // Construct shared URL
    const baseUrl = page.url().split("?")[0];
    const pageBlobId = await page.evaluate(() => {
      const activeEl = document.querySelector(".blob-item.active");
      return activeEl?.getAttribute("data-id") || "";
    });

    let copiedUrl = `${baseUrl}?shared=${pageBlobId}`;
    if (!pageBlobId) {
      copiedUrl = await page.evaluate(() => navigator.clipboard.readText());
    }

    // 1. Unauthenticated user (fresh browser context) opens shared URL -> should be prompted to sign in
    const unauthContext = await browser.newContext();
    const unauthPage = await unauthContext.newPage();
    await unauthPage.goto(copiedUrl);
    await unauthPage.waitForLoadState("networkidle");
    const authModal = unauthPage.locator("#shared-auth-modal");
    await expect(authModal).toBeVisible();
    const loginLink = unauthPage.locator("#shared-login-btn");
    await expect(loginLink).toBeVisible();

    // 2. Authenticated recipient opens shared URL -> should load shared blob & recipient's workspace JSONs
    await unauthPage.goto("/api/auth/dev-login?email=recipient@test.com&name=Recipient+User");
    await unauthPage.waitForLoadState("networkidle");
    await unauthPage.goto(copiedUrl);
    await unauthPage.waitForLoadState("networkidle");

    const newEditorContent = unauthPage.locator(".cm-content");
    await expect(newEditorContent).toBeVisible();
    const text = await newEditorContent.innerText();
    expect(text).toContain("Alice Chen");
    expect(text).toContain("Shipped");

    // Sidebar contains the shared blob alongside recipient's saved workspace
    const sidebarBlobItems = unauthPage.locator(".blob-item");
    await expect(sidebarBlobItems.first()).toBeVisible();

    // 3. Recipient saves the shared blob to their workspace
    const recipientSaveBtn = unauthPage.locator("#save-blob-btn");
    await expect(recipientSaveBtn).toBeVisible();
    await recipientSaveBtn.click();
    await expect(unauthPage.getByText("Saved! ✓")).toBeVisible();
  });

  test("should handle creating, saving, and deleting a blob from the workspace", async ({ page }) => {
    await page.goto("/api/auth/dev-login?email=e2e@test.com&name=E2E+Tester");
    await page.waitForLoadState("networkidle");

    // Wait for sidebar to load
    await expect(page.locator(".blob-item").first()).toBeVisible();

    // 1. Click "+ New blob"
    await page.locator("#new-blob-btn").click();

    // 2. Clear editor and fill with unique JSON content
    const editor = page.locator(".cm-content");
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    const uniqueVal = `delete_me_${Math.floor(Math.random() * 1000000)}`;
    await editor.fill(`{"delete_test": "${uniqueVal}"}`);

    // 3. Rename the blob
    const nameDisplay = page.locator("#blob-name-display");
    await expect(nameDisplay).toBeVisible();
    await nameDisplay.click();
    const nameInput = page.locator("#blob-name-input");
    await expect(nameInput).toBeVisible();
    const blobName = `Blob To Delete ${uniqueVal}`;
    await nameInput.fill(blobName);
    await page.keyboard.press("Enter");

    // 4. Save the blob
    const saveBtn = page.locator("#save-blob-btn");
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();
    await expect(page.locator("text=Saved! ✓")).toBeVisible();

    // 5. Verify the blob appears in the sidebar list
    const sidebarItem = page.locator(".file-sidebar").locator(`text=${blobName}`);
    await expect(sidebarItem).toBeVisible();

    // 6. Delete the blob (accepting the confirmation dialog)
    page.on("dialog", async (dialog) => {
      expect(dialog.message()).toContain(`delete "${blobName}"`);
      await dialog.accept();
    });

    const blobContainer = page.locator(".blob-item", { hasText: blobName });
    await blobContainer.hover();
    const deleteBtn = blobContainer.locator(".blob-delete-btn");
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // 7. Verify the blob item is removed from the sidebar
    await expect(sidebarItem).not.toBeVisible();
  });

  test("should support exporting active blob into JSON, CSV, YAML, and TSV formats", async ({ page }) => {
    await page.goto("/api/auth/dev-login?email=e2e@test.com&name=E2E+Tester");
    await page.waitForLoadState("networkidle");

    await createAndPopulateBlob(page);

    // Click Export dropdown
    const exportBtn = page.locator("#export-blob-btn");
    await expect(exportBtn).toBeVisible();
    await exportBtn.click();

    // Verify format options are displayed
    await expect(page.locator("#export-opt-json")).toBeVisible();
    await expect(page.locator("#export-opt-csv")).toBeVisible();
    await expect(page.locator("#export-opt-yaml")).toBeVisible();
    await expect(page.locator("#export-opt-tsv")).toBeVisible();

    // Test JSON export download
    const downloadPromise = page.waitForEvent("download");
    await page.locator("#export-opt-json").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain(".json");
  });

  test("should support global keyboard shortcuts for search, save, and formatting", async ({ page }) => {
    await page.goto("/api/auth/dev-login?email=e2e@test.com&name=E2E+Tester");
    await page.waitForLoadState("networkidle");

    // 1. Test Ctrl+K / Cmd+K to focus search input
    await page.keyboard.press("Control+K");
    const searchInput = page.locator("#sidebar-search");
    await expect(searchInput).toBeFocused();

    // 2. Populate editor with unformatted valid JSON
    const editor = page.locator(".cm-content");
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    await editor.fill('{"a":1,"b":2}');

    // 3. Test Ctrl+Shift+F / Cmd+Shift+F to auto-format
    await page.keyboard.press("Control+Shift+F");
    const text = await editor.innerText();
    expect(text).toContain('\n  "a": 1');

    // 4. Test Ctrl+S / Cmd+S to trigger save
    await page.keyboard.press("Control+S");
    await expect(page.locator("text=Saved! ✓")).toBeVisible();
  });

  test("should allow importing JSON files using file input", async ({ page }) => {
    await page.goto("/api/auth/dev-login?email=e2e@test.com&name=E2E+Tester");
    await page.waitForLoadState("networkidle");

    // Click Import File button
    const importBtn = page.locator("#import-file-btn");
    await expect(importBtn).toBeVisible();

    // Upload sample file buffer
    const fileInput = page.locator("#import-file-input");
    await fileInput.setInputFiles({
      name: "uploaded_data.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"imported_key": "success_import_value"}')
    });

    // Verify editor is populated with imported file content
    const editorContent = page.locator(".cm-content");
    await expect(editorContent).toBeVisible();
    const text = await editorContent.innerText();
    expect(text).toContain("success_import_value");
  });
});
