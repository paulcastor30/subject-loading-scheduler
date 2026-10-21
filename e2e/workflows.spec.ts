import { expect, test, type Page } from "@playwright/test";
import { sampleData } from "../tests/fixtures/academicData";
import { backup } from "../src/lib/storage";

// Provision only through the real backup-restoration UI. No test-data loader is shipped.
async function restoreTestRecords(page: Page) {
  await page.goto("#settings/import");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Restore JSON backup").setInputFiles({
    name: "automated-test.backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup(sampleData())),
  });
  await expect(page.getByText("Backup restored successfully.")).toBeVisible();
}

test("academic workflow, persistence, room search, exports and backup restore", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await restoreTestRecords(page);
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
  await restoreTestRecords(page);
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

test("production workspace starts empty and backup shortcut opens recovery tools", async ({
  page,
}) => {
  await page.goto("");
  await expect(page.getByLabel("Academic term", { exact: true })).toHaveValue(
    "",
  );
  await expect(
    page.getByRole("button", { name: "Create semester workspace" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back up your data ↗" }).click();
  await expect(
    page.getByRole("heading", { name: "Backups & local storage" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /sample|fictional/i }),
  ).toHaveCount(0);
  await expect(page.getByText(/prospectus|simulation/i)).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Backups & local storage" }),
  ).toBeVisible();
});

test("separate lab groups, parallel rooms, faculty duties and Form 3 report", async ({
  page,
}, testInfo) => {
  await restoreTestRecords(page);
  await page.getByRole("button", { name: "Academic records & rules" }).click();
  await page.getByLabel("Record type", { exact: true }).selectOption("rooms");
  await page.getByRole("button", { name: "+ Add record" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Second laboratory");
  await page.getByLabel("Code", { exact: true }).fill("LAB 2");
  await page.getByLabel("Building", { exact: true }).fill("Example building");
  await page.getByLabel("Type", { exact: true }).selectOption("laboratory");
  await page.getByLabel("Capacity", { exact: true }).fill("20");
  await page.getByRole("button", { name: "Save record" }).click();
  await page.getByRole("link", { name: "Loading & scheduling" }).click();
  await page.getByRole("button", { name: /CS 201 · BSCS 2A/ }).click();
  await page
    .getByRole("button", { name: "Set up lecture & lab groups →" })
    .click();
  const labA = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Lab A", exact: true }) });
  await labA.getByRole("button", { name: "Split lab into two" }).click();
  await expect(labA.getByLabel("Students in this group")).toHaveValue("14");
  await labA.getByLabel("Faculty for this group").selectOption("fac1");
  await labA.getByRole("button", { name: "Save group" }).click();
  await expect(labA.getByRole("button", { name: "Save group" })).toBeDisabled();
  const labB = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Lab 2", exact: true }) });
  await labB.getByLabel("Faculty for this group").selectOption("fac2");
  await labB.getByRole("button", { name: "Save group" }).click();
  await expect(labB.getByRole("button", { name: "Save group" })).toBeDisabled();
  for (const lab of [labA, labB]) {
    await lab.getByRole("button", { name: "Schedule this group" }).click();
    await lab.getByLabel("Day", { exact: true }).selectOption("1");
    await lab.getByLabel("Start time", { exact: true }).fill("08:00");
    await lab.getByLabel("End time", { exact: true }).fill("11:00");
  }
  await labA.getByLabel("Available room").selectOption("room2");
  await labA.getByRole("button", { name: "Save meeting", exact: true }).click();
  await expect(
    labA.getByText("Tuesday 08:00–11:00", { exact: true }),
  ).toBeVisible();
  await labB
    .getByLabel("Available room")
    .selectOption({ label: "LAB 2 · 20 seats" });
  await labB.getByRole("button", { name: "Save meeting", exact: true }).click();
  await expect(
    labB.getByText("Tuesday 08:00–11:00", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("group-scheduling.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Faculty loads", exact: true }).click();
  await page.getByLabel("Faculty member", { exact: true }).selectOption("fac2");
  await page.getByLabel("Duty or activity").fill("Example adviser duty");
  await page.getByLabel("Credited units", { exact: true }).fill("2");
  await page
    .getByLabel("Order, approval or source reference")
    .fill("Example order");
  await page.getByRole("button", { name: "Save duty" }).click();
  await expect(
    page.getByText("Example adviser duty · 2.00 units"),
  ).toBeVisible();
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await page
    .getByLabel("Report", { exact: true })
    .selectOption("OVCAA Form 3 Loading Summary");
  await page.getByLabel("Faculty member", { exact: true }).selectOption("fac2");
  await expect(
    page.getByText("Total faculty load", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "5.00", exact: true }),
  ).toBeVisible();
  const excel = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Excel" }).click();
  expect((await excel).suggestedFilename()).toContain("OVCAA-Form-3");
  await page.reload();
  await page
    .getByLabel("Report", { exact: true })
    .selectOption("OVCAA Form 3 Loading Summary");
  await page.getByLabel("Faculty member", { exact: true }).selectOption("fac2");
  await expect(
    page.getByRole("cell", { name: "Example adviser duty", exact: true }),
  ).toBeVisible();
});

test("semester setup and selected Form 3 import with reviewed group credits", async ({
  page,
}) => {
  const { default: writeXlsxFile } = await import("write-excel-file/node");
  const matrix = [
    ["Example institution"],
    ["First semester 2026–2027"],
    [
      "NAME OF FACULTY",
      "Course No./Section/Adm. Function",
      "SCHEDULE",
      "DAY",
      "Room Assignment",
      "Academic /Adm.Load",
      "OVERLOAD",
      "No. of Students",
    ],
    [
      "Example Teacher (Lecturer)",
      "BCA111-B181",
      "8:00AM - 10:00AM",
      "M",
      "ROOM A",
      2,
      null,
      30,
    ],
    [
      null,
      "BCA111-B181 (LAB)",
      "1:00PM - 4:00PM",
      "T",
      "LAB A",
      2.55,
      null,
      15,
    ],
    [
      null,
      "BCA111-B181.1 (LAB)",
      "1:00PM - 4:00PM",
      "Th",
      "LAB A",
      2.55,
      null,
      15,
    ],
    [null, "Example adviser duty", "-", "-", "-", 2, null, "-"],
    [null, "TOTAL FACULTY LOAD", null, null, null, 9.1],
  ];
  const buffer = await writeXlsxFile(
    matrix.map((row) =>
      row.map((value) => (value === null ? null : { value })),
    ),
    { buffer: true },
  );
  await page.goto("");
  await page.getByLabel("Academic year", { exact: true }).fill("2026–2027");
  await page.getByRole("button", { name: "Create semester workspace" }).click();
  await expect(page.getByLabel("Academic term", { exact: true })).toContainText(
    "2026–2027",
  );
  await page.getByRole("button", { name: "Import previous loading" }).click();
  await page.getByLabel("Choose Form 3 workbook").setInputFiles({
    name: "example-form-3.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer,
  });
  await page
    .getByLabel("Loading worksheet", { exact: true })
    .selectOption({ index: 1 });
  await page.getByLabel("Course title BCA111").fill("Example computing course");
  await page.getByLabel("Course units BCA111").fill("3");
  await page.getByLabel("Year level for B181").selectOption("1");
  await page.getByLabel(/I reviewed this worksheet/).check();
  await page
    .getByRole("button", { name: "Validate and preview loading" })
    .click();
  await expect(page.getByText("Ready to add:", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Import reviewed loading" }).click();
  await expect(
    page.getByText("Loading imported.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Faculty loads", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "Example Teacher" });
  await expect(
    row.getByRole("cell", { name: "9.10 / 18", exact: true }),
  ).toBeVisible();
  await expect(row.getByRole("cell", { name: "1", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Loading & scheduling" }).click();
  await page.getByRole("button", { name: /BCA111 · B181/ }).click();
  await expect(
    page.getByRole("heading", { name: "Lab B181.1", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /BCA111 · B181/ }).click();
  await expect(
    page.getByRole("heading", { name: "Lab B181.1", exact: true }),
  ).toBeVisible();
});
