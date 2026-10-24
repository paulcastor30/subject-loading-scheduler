import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { sampleData } from "../../tests/fixtures/academicData";
import { checkData } from "../lib/storage";
import { emptyData, type Data } from "../lib/model";
import { AddClasses } from "./AddClasses";

it("links an empty workspace to semester setup instead of accepting classes", () => {
  render(
    <AddClasses
      data={emptyData()}
      term=""
      commit={vi.fn()}
      onDone={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent(/Start a semester/);
  expect(
    screen.getByRole("link", { name: "Set up semester →" }),
  ).toHaveAttribute("href", "#dashboard/setup");
  expect(screen.getByRole("button", { name: "Add classes" })).toBeDisabled();
});

function Workspace({
  initial = sampleData(),
  fail = false,
}: {
  initial?: Data;
  fail?: boolean;
}) {
  const [data, setData] = useState(initial);
  return (
    <>
      <AddClasses
        data={data}
        term="term1"
        commit={async (next) => {
          if (fail) return false;
          setData(checkData(next));
          return true;
        }}
        onDone={() => {}}
        onCancel={() => {}}
      />
      <output aria-label="Saved classes">
        {data.offerings
          .map((o) => `${o.semesterId}/${o.sectionId}/${o.subjectId}`)
          .join(",")}
      </output>
    </>
  );
}

it("adds several selected subjects to one section without duplicating existing classes", async () => {
  const user = userEvent.setup();
  render(<Workspace />);
  await user.selectOptions(screen.getByLabelText("Student section"), "sec2");
  expect(screen.getByRole("checkbox", { name: /CS 201/ })).toBeDisabled();
  await user.click(screen.getByRole("checkbox", { name: /CS 101/ }));
  await user.click(screen.getByRole("checkbox", { name: /MATH 101/ }));
  await user.click(screen.getByRole("button", { name: "Add 2 classes" }));
  expect(screen.getByLabelText("Saved classes")).toHaveTextContent(
    "term1/sec2/sub1",
  );
  expect(screen.getByLabelText("Saved classes")).toHaveTextContent(
    "term1/sec2/sub3",
  );
  expect(
    screen.getByLabelText("Saved classes").textContent!.split(","),
  ).toHaveLength(5);
});

it("keeps selected subjects across search and navigation until a successful save", async () => {
  const user = userEvent.setup(),
    view = render(<Workspace fail />);
  await user.selectOptions(screen.getByLabelText("Student section"), "sec2");
  await user.click(screen.getByRole("checkbox", { name: /CS 101/ }));
  await user.type(screen.getByLabelText("Find subjects"), "MATH");
  await user.click(screen.getByRole("checkbox", { name: /MATH 101/ }));
  await user.click(screen.getByRole("button", { name: "Add 2 classes" }));
  expect(screen.getByRole("alert")).toHaveTextContent(/not saved/i);
  view.unmount();
  render(<Workspace />);
  expect(screen.getByLabelText("Student section")).toHaveValue("sec2");
  expect(screen.getByRole("button", { name: "Add 2 classes" })).toBeEnabled();
  await user.clear(screen.getByLabelText("Find subjects"));
  expect(screen.getByRole("checkbox", { name: /CS 101/ })).toBeChecked();
});

it("restricts subjects to the section program and clears selections when the section changes", async () => {
  const data = sampleData(),
    user = userEvent.setup();
  data.programs.push({ id: "p2", name: "Education", code: "ED" });
  data.curricula.push({
    id: "c2",
    name: "Education curriculum",
    programId: "p2",
  });
  data.subjects.push({
    ...data.subjects[2],
    id: "ed1",
    code: "ED 101",
    curriculumId: "c2",
  });
  data.sections.push({
    ...data.sections[0],
    id: "edsec",
    name: "ED 1A",
    programId: "p2",
  });
  render(<Workspace initial={data} />);
  await user.selectOptions(screen.getByLabelText("Student section"), "sec2");
  await user.click(screen.getByRole("checkbox", { name: /CS 101/ }));
  expect(
    screen.queryByRole("checkbox", { name: /ED 101/ }),
  ).not.toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Student section"), "edsec");
  expect(
    screen.queryByRole("checkbox", { name: /CS 101/ }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add classes" })).toBeDisabled();
  await user.click(screen.getByRole("checkbox", { name: /ED 101/ }));
  await user.click(screen.getByRole("button", { name: "Add 1 class" }));
  expect(screen.getByLabelText("Saved classes")).toHaveTextContent(
    "term1/edsec/ed1",
  );
});

it("prevents class creation in a finalized semester", async () => {
  const data = sampleData(),
    commit = vi.fn(),
    user = userEvent.setup();
  data.semesters[0].finalized = true;
  render(
    <AddClasses
      data={data}
      term="term1"
      commit={commit}
      onDone={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent(/reopen/i);
  expect(screen.getByRole("button", { name: "Add classes" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Add classes" }));
  expect(commit).not.toHaveBeenCalled();
});

it("recovers an unfinished single-class form from the previous editor", () => {
  sessionStorage.setItem(
    "slss-draft-v1:new-offering:term1",
    JSON.stringify({
      value: {
        id: "draft",
        semesterId: "term1",
        sectionId: "sec2",
        subjectId: "sub1",
      },
      baseline: {
        id: "draft",
        semesterId: "term1",
        sectionId: "",
        subjectId: "",
      },
      label: "Old class",
      href: "#scheduling/new?term=term1",
    }),
  );
  render(<Workspace />);
  expect(screen.getByLabelText("Student section")).toHaveValue("sec2");
  expect(screen.getByRole("checkbox", { name: /CS 101/ })).toBeChecked();
  expect(screen.getByRole("button", { name: "Add 1 class" })).toBeEnabled();
});
