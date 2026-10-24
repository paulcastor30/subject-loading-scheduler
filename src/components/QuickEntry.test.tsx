import { useState } from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { sampleData } from "../../tests/fixtures/academicData";
import { checkData } from "../lib/storage";
import { type QuickEntity } from "../lib/quickEntry";
import { QuickEntry } from "./QuickEntry";
import { Records } from "./Records";

function Workspace({ entity = "faculty" }: { entity?: QuickEntity }) {
  const [data, setData] = useState(sampleData);
  return (
    <>
      <QuickEntry
        data={data}
        entity={entity}
        commit={async (next) => {
          setData(checkData(next));
          return true;
        }}
        onClose={() => {}}
      />
      <output aria-label="Saved records">{JSON.stringify(data[entity])}</output>
    </>
  );
}

it("continues by Enter and saves successive faculty batches with retained defaults and new identities", async () => {
  const user = userEvent.setup();
  render(<Workspace />);
  await user.clear(screen.getByLabelText("Default load limit"));
  await user.type(screen.getByLabelText("Default load limit"), "15");
  await user.type(screen.getByLabelText("Name row 1"), "Pat Manual{Enter}");
  expect(screen.getByLabelText("Name row 2")).toHaveFocus();
  await user.type(screen.getByLabelText("Name row 2"), "Lee Manual");
  await user.click(
    screen.getByRole("button", { name: "Save 2 faculty records" }),
  );
  expect(screen.getByLabelText("Saved records")).toHaveTextContent(
    '"name":"Pat Manual"',
  );
  expect(screen.getByLabelText("Name row 1")).toHaveValue("");
  expect(screen.getByLabelText("Default load limit")).toHaveValue(15);
  await user.type(screen.getByLabelText("Name row 1"), "Jo Manual");
  await user.click(
    screen.getByRole("button", { name: "Save 1 faculty record" }),
  );
  const records = JSON.parse(
    screen.getByLabelText("Saved records").textContent!,
  );
  expect(records.slice(-3).map((r: { maxLoad: number }) => r.maxLoad)).toEqual([
    15, 15, 15,
  ]);
  expect(new Set(records.map((r: { id: string }) => r.id)).size).toBe(5);
});

it("duplicates and removes unsaved room rows while identifying duplicate codes", async () => {
  const user = userEvent.setup();
  render(<Workspace entity="rooms" />);
  await user.type(screen.getByLabelText("Default building"), "Main");
  await user.type(screen.getByLabelText("Code row 1"), "RM 9");
  await user.type(screen.getByLabelText("Name row 1"), "Lecture room");
  await user.click(screen.getByRole("button", { name: "Duplicate row 1" }));
  expect(screen.getByLabelText("Code row 2")).toHaveValue("RM 9");
  expect(
    screen.getByRole("button", { name: "Save 2 room records" }),
  ).toBeDisabled();
  await user.clear(screen.getByLabelText("Code row 2"));
  await user.type(screen.getByLabelText("Code row 2"), "RM 10");
  expect(
    screen.getByRole("button", { name: "Save 2 room records" }),
  ).toBeEnabled();
  await user.click(screen.getByRole("button", { name: "Remove row 1" }));
  expect(screen.getByLabelText("Code row 1")).toHaveValue("RM 10");
  await user.click(screen.getByRole("button", { name: "Save 1 room record" }));
  const saved = JSON.parse(
    screen.getByLabelText("Saved records").textContent!,
  ).at(-1);
  expect(saved).toMatchObject({
    code: "RM 10",
    building: "Main",
    capacity: 30,
    type: "classroom",
  });
});

it("keeps invalid pasted values visible for correction", async () => {
  const user = userEvent.setup();
  render(<Workspace entity="rooms" />);
  await user.type(screen.getByLabelText("Default building"), "Main");
  await user.click(screen.getByText("Paste rows from Excel or a list"));
  await user.type(
    screen.getByLabelText("Pasted rows"),
    "Code\tName\tCapacity\tType\nRM NEW\tNew room\tmany\tAuditorium",
  );
  await user.click(screen.getByRole("button", { name: "Add pasted rows" }));
  expect(screen.getByLabelText("Capacity row 1")).toHaveValue("many");
  expect(screen.getByLabelText("Type row 1")).toHaveValue("auditorium");
  expect(screen.getByLabelText("Capacity row 1")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await user.clear(screen.getByLabelText("Capacity row 1"));
  await user.type(screen.getByLabelText("Capacity row 1"), "40");
  await user.selectOptions(screen.getByLabelText("Type row 1"), "classroom");
  expect(
    screen.getByRole("button", { name: "Save 1 room record" }),
  ).toBeEnabled();
});

it("appends pasted names without replacing manually entered rows", async () => {
  const user = userEvent.setup();
  render(<Workspace />);
  await user.type(screen.getByLabelText("Name row 1"), "Typed Person");
  await user.click(screen.getByText("Paste rows from Excel or a list"));
  await user.type(
    screen.getByLabelText("Pasted rows"),
    "Cruz, Sam\nReyes, Ada",
  );
  await user.click(screen.getByRole("button", { name: "Add pasted rows" }));
  expect(screen.getByLabelText("Name row 1")).toHaveValue("Typed Person");
  expect(screen.getByLabelText("Name row 2")).toHaveValue("Cruz, Sam");
  expect(screen.getByLabelText("Name row 3")).toHaveValue("Reyes, Ada");
  await user.click(
    screen.getByRole("button", { name: "Save 3 faculty records" }),
  );
  expect(screen.getByLabelText("Saved records")).toHaveTextContent("Cruz, Sam");
});

it("shows paste errors at the paste box without losing entered rows or pasted text", async () => {
  const user = userEvent.setup();
  render(<Workspace />);
  await user.type(screen.getByLabelText("Name row 1"), "Keep this person");
  await user.click(screen.getByText("Paste rows from Excel or a list"));
  await user.type(screen.getByLabelText("Pasted rows"), '"Unclosed name');
  await user.click(screen.getByRole("button", { name: "Add pasted rows" }));
  const pasteBox = screen.getByLabelText("Pasted rows").closest("details")!;
  expect(within(pasteBox).getByRole("alert")).toHaveTextContent(/quote/i);
  expect(screen.getByLabelText("Name row 1")).toHaveValue("Keep this person");
  expect(screen.getByLabelText("Pasted rows")).toHaveValue('"Unclosed name');
  expect(
    screen.getByRole("button", { name: "Save 1 faculty record" }),
  ).toBeDisabled();
});

it("protects rows during a pending save and retains them after failure", async () => {
  const user = userEvent.setup();
  let finish!: (ok: boolean) => void;
  render(
    <QuickEntry
      data={sampleData()}
      entity="faculty"
      commit={() =>
        new Promise((resolve) => {
          finish = resolve;
        })
      }
      onClose={vi.fn()}
    />,
  );
  await user.type(screen.getByLabelText("Name row 1"), "Pending Person");
  await user.click(
    screen.getByRole("button", { name: "Save 1 faculty record" }),
  );
  expect(screen.getByLabelText("Name row 1")).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Back to records" }),
  ).toBeDisabled();
  await act(async () => finish(false));
  expect(screen.getByLabelText("Name row 1")).toHaveValue("Pending Person");
  expect(screen.getByRole("alert")).toHaveTextContent(/not saved/i);
});

it("recovers rows, optional details, defaults and unapplied paste after navigation", async () => {
  const user = userEvent.setup(),
    view = render(<Workspace />);
  await user.type(screen.getByLabelText("Name row 1"), "Draft Person");
  await user.click(screen.getByLabelText("Show optional columns"));
  await user.type(screen.getByLabelText("Rank row 1"), "Professor");
  await user.click(screen.getByText("Paste rows from Excel or a list"));
  await user.type(screen.getByLabelText("Pasted rows"), "Unapplied Person");
  view.unmount();
  render(<Workspace />);
  expect(screen.getByLabelText("Name row 1")).toHaveValue("Draft Person");
  expect(screen.getByLabelText("Rank row 1")).toHaveValue("Professor");
  expect(screen.getByLabelText("Pasted rows")).toHaveValue("Unapplied Person");
});

it("revalidates a code if other records change before saving", async () => {
  const user = userEvent.setup(),
    data = sampleData(),
    commit = vi.fn();
  const view = render(
    <QuickEntry
      data={data}
      entity="subjects"
      commit={commit}
      onClose={vi.fn()}
    />,
  );
  await user.type(screen.getByLabelText("Code row 1"), "CS 301");
  await user.type(screen.getByLabelText("Title row 1"), "Algorithms");
  expect(
    screen.getByRole("button", { name: "Save 1 subject record" }),
  ).toBeEnabled();
  const next = structuredClone(data);
  next.subjects.push({ ...data.subjects[2], id: "new", code: "CS 301" });
  view.rerender(
    <QuickEntry
      data={next}
      entity="subjects"
      commit={commit}
      onClose={vi.fn()}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Save 1 subject record" }),
  ).toBeDisabled();
  expect(screen.getByLabelText("Code row 1")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(commit).not.toHaveBeenCalled();
});

it("explains a missing curriculum beside the shared selection", async () => {
  const user = userEvent.setup(),
    data = sampleData();
  data.curricula.push({
    id: "curr2",
    name: "Another version",
    programId: "program1",
  });
  render(
    <QuickEntry
      data={data}
      entity="subjects"
      commit={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  await user.type(screen.getByLabelText("Code row 1"), "CS 301");
  await user.type(screen.getByLabelText("Title row 1"), "Algorithms");
  expect(
    within(screen.getByRole("region", { name: "Shared defaults" })).getByRole(
      "alert",
    ),
  ).toHaveTextContent(/Choose a curriculum/);
  await user.selectOptions(
    screen.getByLabelText("Curriculum for this batch"),
    "curr2",
  );
  expect(
    screen.getByRole("button", { name: "Save 1 subject record" }),
  ).toBeEnabled();
});

it("opens quick entry through its draft route while preserving individual forms", async () => {
  const user = userEvent.setup();
  render(
    <Records
      data={sampleData()}
      initialEntity="faculty"
      initialRecordId="quick"
      commit={vi.fn()}
    />,
  );
  expect(screen.getByLabelText("Name row 1")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Back to records" }));
  await user.click(screen.getByRole("button", { name: "+ Add record" }));
  expect(screen.getByLabelText("Name")).toBeVisible();
});
