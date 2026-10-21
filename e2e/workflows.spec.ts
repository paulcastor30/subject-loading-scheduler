import { expect, test } from "@playwright/test";
test("academic workflow, persistence, room search, exports and backup restore", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("");
  await page.getByRole("link", { name: "Settings & data" }).click();
  await page.getByRole("button", { name: "Data management & backups" }).click();
  await page
    .getByRole("button", { name: "Load fictional sample data" })
    .click();
  await expect(
    page.getByText("Sample loaded.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Loading & scheduling" }).click();
  await page.getByRole("button", { name: /CS 201 · BSCS 2A/ }).click();
  await page.getByLabel("Faculty member").selectOption("fac1");
  await page
    .getByRole("button", { name: "Assign faculty", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Update faculty" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "+ Add meeting" }).click();
  await page.getByLabel("Room", { exact: true }).last().selectOption("room1");
  await page.getByLabel("Day", { exact: true }).selectOption("1");
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(
    page.getByText("Tuesday 08:00–09:00", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /CS 201 · BSCS 2A/ }).click();
  await expect(
    page.getByText("Tuesday 08:00–09:00", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Quick edit", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "CS 201 · BSCS 2A" });
  await row.getByLabel("Meeting start").fill("10:00");
  await row.getByLabel("Meeting end").fill("11:00");
  await row.getByRole("button", { name: "Save row" }).click();
  await expect(row.getByRole("button", { name: "Save row" })).toBeDisabled();
  await page.getByRole("button", { name: "↶ Undo" }).click();
  await expect(row.getByLabel("Meeting start")).toHaveValue("08:00");
  await page.getByRole("button", { name: "↷ Redo" }).click();
  await expect(row.getByLabel("Meeting start")).toHaveValue("10:00");
  await page.getByRole("link", { name: "Rooms", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /CL 202 Available/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await page
    .getByLabel("Report", { exact: true })
    .selectOption("Subject Offerings and Assignments");
  const excelPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Excel" }).click();
  const excel = await excelPromise;
  expect(excel.suggestedFilename()).toMatch(/\.xlsx$/);
  await page.getByRole("link", { name: "Settings & data" }).click();
  await page.getByRole("button", { name: "Data management & backups" }).click();
  const backupPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download full JSON backup" }).click();
  const backup = await backupPromise;
  const backupPath = await backup.path();
  expect(backupPath).toBeTruthy();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Restore JSON backup").setInputFiles(backupPath!);
  await expect(page.getByText("Backup restored successfully.")).toBeVisible();
  expect(errors).toEqual([]);
});
test("hash route survives direct refresh under GitHub Pages subpath", async ({
  page,
}) => {
  await page.goto("#rooms");
  await expect(
    page.getByRole("heading", { name: "Find an available room" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Find an available room" }),
  ).toBeVisible();
});

test("Excel imports require preview and show row errors before commit", async ({
  page,
}) => {
  const { default: writeXlsxFile } = await import("write-excel-file/node");
  const buffer = await writeXlsxFile(
    [
      [{ value: "name" }, { value: "maxLoad" }, { value: "active" }],
      [{ value: "Imported faculty" }, { value: 15 }, { value: true }],
      [{ value: "Invalid faculty" }, { value: -1 }, { value: true }],
    ],
    { buffer: true },
  );
  await page.goto("#settings");
  await page.getByRole("button", { name: "Data management & backups" }).click();
  await page.getByLabel("Choose import file").setInputFiles({
    name: "faculty.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer,
  });
  await page
    .getByRole("button", { name: "Validate and preview 2 rows" })
    .click();
  await expect(
    page.getByText(
      "1 valid new records · 1 rejected rows · no records overwritten",
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Commit 1 valid rows (skip rejected rows)" })
    .click();
  await expect(
    page.getByText("Imported 1 valid records. 1 rejected rows were skipped."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Academic records & rules" }).click();
  await expect(
    page.getByRole("cell", { name: "Imported faculty", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Invalid faculty", exact: true }),
  ).toHaveCount(0);
});

test("loaded application edits offline and produces a print-ready PDF", async ({
  page,
  context,
}, testInfo) => {
  await page.goto("#settings");
  await page.getByRole("button", { name: "Data management & backups" }).click();
  await page
    .getByRole("button", { name: "Load fictional sample data" })
    .click();
  await expect(
    page.getByText("Sample loaded.", { exact: false }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.getByRole("link", { name: "Loading & scheduling" }).click();
  await page.getByRole("button", { name: /MATH 101 · BSCS 1A/ }).click();
  await page.getByLabel("Faculty member").selectOption("fac2");
  await page
    .getByRole("button", { name: "Assign faculty", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Update faculty" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await page
    .getByLabel("Report", { exact: true })
    .selectOption("Faculty Weekly Schedule");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Excel" }).click();
  expect((await download).suggestedFilename()).toMatch(/xlsx$/);
  await page.emulateMedia({ media: "print" });
  await expect(
    page.getByRole("heading", { name: "Faculty Weekly Schedule" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Overview", exact: true }),
  ).toBeHidden();
  const pdf = await page.pdf({
    path: testInfo.outputPath("faculty-weekly-schedule.pdf"),
    format: "A4",
    landscape: true,
  });
  expect(pdf.byteLength).toBeGreaterThan(5000);
  await page.emulateMedia({ media: "screen" });
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath("semester-overview.png"),
    fullPage: true,
  });
});

test("BSCA prospectus preview adds all courses safely and persists across refresh", async ({
  page,
}) => {
  await page.goto("#settings");
  await page.getByRole("button", { name: "Data management & backups" }).click();
  await page
    .getByText("Review course list and source notes", { exact: true })
    .click();
  await page.getByLabel("Preview year or electives").selectOption("4");
  await expect(
    page.getByRole("cell", { name: "BCA197", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "40", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add BSCA prospectus sample", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "BSCA prospectus sample added",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByLabel("Academic term", { exact: true })
    .selectOption("bsca-2018-semester-1");
  await page.getByRole("link", { name: "Loading & scheduling" }).click();
  await expect(
    page.getByRole("heading", { name: "Subject offerings (28)" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /BCA111 · BSCA 1A \(sample\)/ }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Subject offerings (28)" }),
  ).toBeVisible();
  await page
    .getByLabel("Academic term", { exact: true })
    .selectOption("bsca-2018-semester-2");
  await expect(
    page.getByRole("heading", { name: "Subject offerings (23)" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Settings & data" }).click();
  await page.getByRole("button", { name: "Data management & backups" }).click();
  await expect(
    page.getByRole("button", {
      name: "BSCA prospectus sample added",
      exact: true,
    }),
  ).toBeDisabled();
});
