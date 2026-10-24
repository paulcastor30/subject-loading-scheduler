import { expect, test, type Page } from "@playwright/test";
import { sampleData } from "../tests/fixtures/academicData";
import { backup } from "../src/lib/storage";

// Provision only through the real backup-restoration UI. No test-data loader is shipped.
async function restoreTestRecords(page: Page, records = sampleData()) {
  await page.goto("#settings/import");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Restore JSON backup").setInputFiles({
    name: "automated-test.backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup(records)),
  });
  await expect(page.getByText("Backup restored successfully.")).toBeVisible();
}

async function chooseRecords(page: Page, entity: string) {
  const picker = page.getByLabel("Record type", { exact: true });
  if (!(await picker.isVisible()))
    await page
      .getByText("Advanced records and department rules", { exact: true })
      .click();
  await picker.selectOption(entity);
}
function groupCard(page: Page, name: string) {
  return page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
}

test("quick entry saves faculty, rooms and subjects with draft recovery and Undo", async ({
  page,
}) => {
  await restoreTestRecords(page);
  await page.getByRole("button", { name: "Academic records & rules" }).click();
  await page.getByRole("button", { name: "Quick entry", exact: true }).click();
  await page.getByLabel("Default load limit").fill("20");
  await page.getByLabel("Name row 1", { exact: true }).fill("Quick Person One");
  await page.getByLabel("Name row 1", { exact: true }).press("Enter");
  await expect(page.getByLabel("Name row 2", { exact: true })).toBeFocused();
  await page.getByLabel("Name row 2", { exact: true }).fill("Quick Person Two");
  await page.getByRole("link", { name: "Rooms", exact: true }).click();
  await page.locator(".draft-banner summary").click();
  await page
    .getByRole("link", { name: /Continue: Quick entry · faculty/ })
    .click();
  await page.reload();
  await expect(page.getByLabel("Name row 2", { exact: true })).toHaveValue(
    "Quick Person Two",
  );
  await expect(page.getByLabel("Default load limit")).toHaveValue("20");
  await page
    .getByRole("button", { name: "Save 2 faculty records", exact: true })
    .click();
  await expect(page.getByText(/Saved 2 faculty records/)).toBeVisible();
  await page.getByRole("button", { name: "Back to records" }).click();
  await expect(
    page.getByRole("row", { name: /Quick Person One/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "↶ Undo" }).click();
  await expect(page.getByRole("row", { name: /Quick Person One/ })).toHaveCount(
    0,
  );
  await expect(page.getByRole("row", { name: /Quick Person Two/ })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "↷ Redo" }).click();
  await expect(
    page.getByRole("row", { name: /Quick Person Two/ }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Rooms", exact: true }).click();
  await page.getByRole("button", { name: "Quick entry", exact: true }).click();
  await page.getByLabel("Default building").fill("New building");
  await page.getByLabel("Default type").selectOption("laboratory");
  await page.getByLabel("Default capacity").fill("45");
  await page
    .getByText("Paste rows from Excel or a list", { exact: true })
    .click();
  await page
    .getByLabel("Pasted rows")
    .fill(
      "Code\tName\nLAB Q1\tQuick laboratory one\nLAB Q2\tQuick laboratory two",
    );
  await page.getByRole("button", { name: "Add pasted rows" }).click();
  await page.getByLabel("Capacity row 2", { exact: true }).fill("50");
  await page
    .getByRole("button", { name: "Save 2 room records", exact: true })
    .click();
  await expect(page.getByText(/Saved 2 room records/)).toBeVisible();
  await page.getByRole("button", { name: "Back to records" }).click();
  await expect(page.getByRole("row", { name: /LAB Q1/ })).toContainText("45");
  await expect(page.getByRole("row", { name: /LAB Q2/ })).toContainText("50");

  await page
    .getByRole("button", { name: "Subjects & sections", exact: true })
    .click();
  await page.getByRole("button", { name: "Quick entry", exact: true }).click();
  await page.getByLabel("Default lecture hours").fill("2");
  await page.getByLabel("Default lab hours").fill("3");
  await page
    .getByText("Paste rows from Excel or a list", { exact: true })
    .click();
  await page
    .getByLabel("Pasted rows")
    .fill(
      "Code\tTitle\tUnits\nQ101\tQuick subject one\t3\nq101\tQuick subject two\t3",
    );
  await page.getByRole("button", { name: "Add pasted rows" }).click();
  await expect(page.getByLabel("Code row 1", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(
    page.getByRole("button", { name: "Save 2 subject records", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Code row 2", { exact: true }).fill("Q102");
  await page.getByLabel("Lab hours row 2", { exact: true }).fill("0");
  await page.getByLabel("Show optional columns").check();
  await page.getByLabel("Equipment row 1", { exact: true }).fill("Projector");
  await page.reload();
  await expect(page.getByLabel("Equipment row 1", { exact: true })).toHaveValue(
    "Projector",
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  const entryRow = await page
    .getByRole("region", { name: "Editable entry table" })
    .getByRole("row")
    .nth(1)
    .boundingBox();
  expect(entryRow!.height).toBeLessThan(120);
  await page.screenshot({
    path: "test-results/quick-entry-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "Save 2 subject records", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/quick-entry-tablet.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Save 2 subject records", exact: true })
    .click();
  await expect(page.getByText(/Saved 2 subject records/)).toBeVisible();
  await page.getByRole("button", { name: "Back to records" }).click();
  await page.reload();
  await expect(page.getByRole("row", { name: /Q101/ })).toContainText(
    "Projector",
  );
  await expect(page.getByRole("row", { name: /Q102/ })).toBeVisible();
  await expect(page.locator(".draft-banner")).toHaveCount(0);
});

test("manual setup guides repeated entry, batch classes, scheduling and refresh", async ({
  page,
}) => {
  await page.goto("#dashboard");
  await page.getByLabel("Academic year", { exact: true }).fill("2026–2027");
  await page.getByRole("button", { name: "Create semester workspace" }).click();
  const nextStep = () => page.getByRole("region", { name: "Your next step" });
  await nextStep()
    .getByRole("button", { name: "Add faculty", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Casey Manual");
  await page.getByRole("button", { name: "Save and add another" }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("");
  await page.getByLabel("Name", { exact: true }).fill("Jordan Manual");
  await page.getByRole("button", { name: "Save record", exact: true }).click();

  await nextStep()
    .getByRole("button", { name: "Add rooms", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Main classroom");
  await page.getByLabel("Code", { exact: true }).fill("ROOM 1");
  await page.getByLabel("Building", { exact: true }).fill("Main building");
  await page.getByLabel("Capacity", { exact: true }).fill("40");
  await page.getByRole("button", { name: "Save record", exact: true }).click();

  await nextStep()
    .getByRole("button", { name: "Add subjects", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Computing Fundamentals");
  await page.getByLabel("Code", { exact: true }).fill("MAN 101");
  await page.getByRole("button", { name: "Save and add another" }).click();
  await page
    .getByLabel("Name", { exact: true })
    .fill("Professional Communication");
  await page.getByLabel("Code", { exact: true }).fill("MAN 102");
  await page.getByRole("button", { name: "Save record", exact: true }).click();

  await nextStep()
    .getByRole("button", { name: "Add sections", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("BSCA 1A");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await nextStep()
    .getByRole("button", { name: "Add classes", exact: true })
    .click();
  await page.getByRole("button", { name: "Select visible subjects" }).click();
  await expect(
    page.getByRole("heading", { name: "Assignment workspace", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Add 2 classes", exact: true }),
  ).toBeEnabled();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: "test-results/manual-classes-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 768, height: 1024 });
  await page
    .getByRole("button", { name: "Add 2 classes", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", { name: "Add 2 classes", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: "test-results/manual-classes-tablet.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page
    .getByRole("button", { name: "Add 2 classes", exact: true })
    .click();
  const lecture = groupCard(page, "Lecture");
  await lecture
    .getByLabel("Faculty for this group")
    .selectOption({ label: "Casey Manual · 0.00 / 18 units" });
  await lecture
    .getByLabel("Available room")
    .selectOption({ label: "ROOM 1 · 40 seats" });
  await lecture
    .getByRole("button", { name: "Save assignment & meeting", exact: true })
    .click();
  await expect(
    lecture.getByText("Monday 08:00–11:00", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await nextStep()
    .getByRole("button", { name: "Continue scheduling", exact: true })
    .click();
  await lecture
    .getByLabel("Faculty for this group")
    .selectOption({ label: "Casey Manual · 3.00 / 18 units" });
  await lecture.getByLabel("Day", { exact: true }).selectOption("1");
  await lecture
    .getByLabel("Available room")
    .selectOption({ label: "ROOM 1 · 40 seats" });
  await lecture
    .getByRole("button", { name: "Save assignment & meeting", exact: true })
    .click();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(
    nextStep().getByRole("button", { name: "Review and print reports" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    nextStep().getByRole("button", { name: "Review and print reports" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/manual-overview-desktop.png",
    fullPage: true,
  });
});

test("academic workflow, persistence, room search, exports and backup restore", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await restoreTestRecords(page);
  await page.getByRole("link", { name: "Loading & scheduling" }).click();
  await page.getByRole("button", { name: /CS 201 · BSCS 2A/ }).click();
  const lecture = groupCard(page, "Lecture");
  await lecture.getByLabel("Faculty for this group").selectOption("fac1");
  await lecture.getByLabel("Day", { exact: true }).selectOption("1");
  await lecture.getByLabel("Available room").selectOption("room1");
  await lecture.getByLabel("End time", { exact: true }).fill("09:00");
  await lecture
    .getByRole("button", { name: "Save assignment & meeting", exact: true })
    .click();
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
  const lecture = groupCard(page, "Lecture");
  await lecture.getByLabel("Faculty for this group").selectOption("fac2");
  await lecture
    .getByRole("checkbox", { name: "Add a weekly meeting", exact: true })
    .uncheck();
  await lecture
    .getByRole("button", { name: "Save assignment", exact: true })
    .click();
  await expect(lecture.getByRole("status")).toContainText("Saved.");
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
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Export Excel", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("link", {
      name: "Create your semester workspace →",
      exact: true,
    }),
  ).toBeVisible();
});

test("separate lab groups, parallel rooms, faculty duties and Form 3 report", async ({
  page,
}, testInfo) => {
  await restoreTestRecords(page);
  await page.getByRole("button", { name: "Academic records & rules" }).click();
  await chooseRecords(page, "rooms");
  await page.getByRole("button", { name: "+ Add record" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Second laboratory");
  await page.getByLabel("Code", { exact: true }).fill("LAB 2");
  await page.getByLabel("Building", { exact: true }).fill("Example building");
  await page.getByLabel("Type", { exact: true }).selectOption("laboratory");
  await page.getByLabel("Capacity", { exact: true }).fill("20");
  await page.getByRole("button", { name: "Save record" }).click();
  await page.getByRole("link", { name: "Loading & scheduling" }).click();
  await page.getByRole("button", { name: /CS 201 · BSCS 2A/ }).click();
  const labA = groupCard(page, "Lab A");
  await labA
    .getByText("Split, unassign or remove this group", { exact: true })
    .click();
  await labA.getByRole("button", { name: "Split lab into two" }).click();
  await expect(labA.getByLabel("Students in this group")).toHaveValue("14");
  const labB = groupCard(page, "Lab 2");
  await labA.getByLabel("Faculty for this group").selectOption("fac1");
  await labB.getByLabel("Faculty for this group").selectOption("fac2");
  for (const lab of [labA, labB]) {
    await lab.getByLabel("Day", { exact: true }).selectOption("1");
    await lab.getByLabel("Start time", { exact: true }).fill("08:00");
    await lab.getByLabel("End time", { exact: true }).fill("11:00");
  }
  await labA.getByLabel("Available room").selectOption("room2");
  await labA
    .getByRole("button", { name: "Save assignment & meeting", exact: true })
    .click();
  await expect(
    labA.getByText("Tuesday 08:00–11:00", { exact: true }),
  ).toBeVisible();
  await labB
    .getByLabel("Available room")
    .selectOption({ label: "LAB 2 · 20 seats" });
  await labB
    .getByRole("button", { name: "Save assignment & meeting", exact: true })
    .click();
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
  await page
    .getByText("All setup tasks and import options", { exact: true })
    .click();
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
  await page.getByRole("link", { name: "Rooms", exact: true }).click();
  await page.locator(".draft-banner summary").click();
  await page
    .getByRole("link", {
      name: "Continue: Previous loading import →",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Course title BCA111")).toHaveValue(
    "Example computing course",
  );
  await expect(page.getByLabel("Course units BCA111")).toHaveValue("3");

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

test("reviewed semester deletion preserves shared records, supports undo and persists", async ({
  page,
}) => {
  await restoreTestRecords(page);
  await page.getByRole("button", { name: "Academic records & rules" }).click();
  await chooseRecords(page, "semesters");
  const first = page.getByRole("row").filter({ hasText: "First semester" });
  await first.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Review deletion" }),
  ).toBeVisible();
  await expect(
    page.getByText("Subject offerings (3)", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Delete 7 records" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(first).toBeVisible();
  await first.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("checkbox", { name: /I reviewed/ }).check();
  await page.getByRole("button", { name: "Delete 7 records" }).click();
  await expect(
    page.getByText("Deleted 7 records.", { exact: false }),
  ).toBeVisible();
  await expect(first).toHaveCount(0);
  await chooseRecords(page, "faculty");
  await expect(
    page.getByRole("cell", { name: "Alex Rivera (sample)", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "↶ Undo" }).click();
  await chooseRecords(page, "semesters");
  await expect(first).toBeVisible();
  await page.getByRole("button", { name: "↷ Redo" }).click();
  await expect(first).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Academic records & rules" }).click();
  await chooseRecords(page, "semesters");
  await expect(first).toHaveCount(0);
  await expect(
    page.getByRole("row").filter({ hasText: "Second semester" }),
  ).toBeVisible();
});

test("bulk deletion, reviewed rule reset and deactivation preserve recoverable history", async ({
  page,
}) => {
  await restoreTestRecords(page);
  await page.getByRole("button", { name: "Academic records & rules" }).click();
  await chooseRecords(page, "subjects");
  await page
    .getByRole("checkbox", { name: "Select all visible records" })
    .check();
  await page
    .getByRole("button", { name: "Delete selected", exact: true })
    .click();
  await expect(page.getByText("Subjects (3)", { exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: /I reviewed/ }).check();
  await page.getByRole("button", { name: "Delete 9 records" }).click();
  await expect(
    page.getByText("Deleted 9 records.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "↶ Undo" }).click();
  await expect(
    page.getByRole("cell", { name: "CS 101", exact: true }),
  ).toBeVisible();
  await chooseRecords(page, "workloadRules");
  await page
    .getByRole("button", { name: "Reset to defaults", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review rule reset" }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: /I reviewed/ }).check();
  await page
    .getByRole("button", { name: "Reset to defaults", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Reset 1 record.", { exact: false }),
  ).toBeVisible();
  await chooseRecords(page, "faculty");
  const faculty = page.getByRole("row").filter({ hasText: "Alex Rivera" });
  await faculty
    .getByRole("button", { name: "Deactivate", exact: true })
    .click();
  await page.getByRole("checkbox", { name: /I reviewed/ }).check();
  await page
    .getByRole("button", { name: "Deactivate 1 record", exact: true })
    .click();
  await expect(
    faculty.getByRole("button", { name: "Activate", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Loading & scheduling" }).click();
  await page.getByRole("button", { name: /CS 101 · BSCS 1A/ }).click();
  await expect(
    page.getByText("Monday 08:00–10:00", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /CS 201 · BSCS 2A/ }).click();
  await expect(
    page
      .getByLabel("Faculty for this group", { exact: true })
      .first()
      .locator('option[value="fac1"]'),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "↶ Undo" }).click();
  await page.getByRole("link", { name: "Settings & data" }).click();
  await chooseRecords(page, "faculty");
  await expect(
    faculty.getByRole("button", { name: "Deactivate", exact: true }),
  ).toBeVisible();
});

test("exact assignment shortcuts and unfinished edits survive navigation and refresh", async ({
  page,
}) => {
  await restoreTestRecords(page);
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page
    .locator(".meeting-row")
    .filter({ hasText: "MATH 101" })
    .getByRole("button", { name: "Assign →", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "MATH 101 · BSCS 1A", exact: true }),
  ).toBeVisible();
  const lecture = groupCard(page, "Lecture");
  await lecture.getByLabel("Faculty for this group").selectOption("fac2");
  await page.getByLabel("Academic term", { exact: true }).selectOption("term2");
  await page.getByRole("link", { name: "Rooms", exact: true }).click();
  await page.locator(".draft-banner summary").click();
  await page.getByRole("link", { name: /Continue: MATH 101/ }).click();
  await expect(page.getByLabel("Academic term", { exact: true })).toHaveValue(
    "term1",
  );
  await expect(lecture.getByLabel("Faculty for this group")).toHaveValue(
    "fac2",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await expect(lecture.getByLabel("Faculty for this group")).toHaveValue(
    "fac2",
  );
  await lecture
    .getByRole("checkbox", { name: "Add a weekly meeting", exact: true })
    .uncheck();
  await lecture
    .getByRole("button", { name: "Save assignment", exact: true })
    .click();
  await expect(page.locator(".draft-banner")).toHaveCount(0);
  await page.getByRole("link", { name: "Settings & data" }).click();
  await page.getByRole("button", { name: "+ Add record", exact: true }).click();
  await page
    .getByLabel("Name", { exact: true })
    .fill("Unfinished faculty profile");
  await page.getByRole("link", { name: "Rooms", exact: true }).click();
  await page.locator(".draft-banner summary").click();
  await page
    .getByRole("link", { name: "Continue: Add faculty →", exact: true })
    .click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Unfinished faculty profile",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".draft-banner")).toHaveCount(0);
  await expect(
    page.getByRole("cell", { name: "Unfinished faculty profile", exact: true }),
  ).toHaveCount(0);
});

test("shared timetable aligns simultaneous classes and supports visible resource filtering", async ({
  page,
}, testInfo) => {
  const records = sampleData();
  records.assignments.push({
    id: "parallel-assignment",
    offeringId: "off2",
    facultyId: "fac2",
  });
  records.meetings.push({
    id: "parallel-meeting",
    offeringId: "off2",
    component: "lecture",
    roomId: "room3",
    day: 0,
    start: "08:00",
    end: "10:00",
  });
  await restoreTestRecords(page, records);
  await page.getByRole("link", { name: "Loading & scheduling" }).click();
  await page
    .getByRole("button", { name: "Weekly timetable", exact: true })
    .click();
  await expect(
    page.getByLabel("Weekly timetable with shared time scale"),
  ).toBeVisible();
  const monday = page.getByRole("region", {
    name: "Monday classes",
    exact: true,
  });
  const a = await monday
    .getByRole("button", { name: /Edit CS 101/ })
    .boundingBox();
  const b = await monday
    .getByRole("button", { name: /Edit CS 201/ })
    .boundingBox();
  expect(a && b).toBeTruthy();
  expect(a!.y).toBe(b!.y);
  expect(a!.x).not.toBe(b!.x);
  expect(a!.height).toBe(b!.height);
  await page
    .getByLabel("Faculty timetable", { exact: true })
    .selectOption("fac1");
  await expect(page.locator(".time-grid-meeting")).toHaveCount(2);
  await page.screenshot({
    path: testInfo.outputPath("weekly-time-grid.png"),
    fullPage: true,
  });
});

test("everyday controls remain usable at laptop and tablet widths", async ({
  page,
}, testInfo) => {
  await restoreTestRecords(page);
  for (const width of [1280, 1024, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("link", { name: "Settings & data" }).click();
    await page
      .getByRole("navigation", { name: "Academic record tasks" })
      .getByRole("button", { name: "Faculty", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "+ Add record", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Loading & scheduling" }).click();
    await page.getByRole("button", { name: /CS 201 · BSCS 2A/ }).click();
    await expect(
      groupCard(page, "Lecture").getByLabel("Faculty for this group"),
    ).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
  }
  await page.screenshot({
    path: testInfo.outputPath("tablet-assignment.png"),
    fullPage: true,
  });
});
