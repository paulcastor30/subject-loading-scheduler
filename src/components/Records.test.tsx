import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { Records } from "./Records";
import { sampleData } from "../../tests/fixtures/academicData";
it("creates and validates a subject through the academic record form", async () => {
  const user = userEvent.setup(),
    commit = vi.fn().mockResolvedValue(true);
  render(
    <Records data={sampleData()} commit={commit} initialEntity="subjects" />,
  );
  await user.click(screen.getByRole("button", { name: "+ Add record" }));
  await user.type(screen.getByLabelText("Name"), "Algorithms");
  await user.type(screen.getByLabelText("Code"), "CS 301");
  await user.selectOptions(screen.getByLabelText("Curriculum"), "curr1");
  await user.click(screen.getByRole("button", { name: "Save record" }));
  expect(commit).toHaveBeenCalledOnce();
  expect(commit.mock.calls[0][0].subjects.at(-1)).toMatchObject({
    name: "Algorithms",
    code: "CS 301",
    lectureHours: 3,
  });
});

it("previews dependent semester deletion with names and counts before committing", async () => {
  const user = userEvent.setup(),
    data = sampleData(),
    commit = vi.fn().mockResolvedValue(true);
  render(<Records data={data} commit={commit} initialEntity="semesters" />);
  await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
  expect(
    screen.getByRole("heading", { name: "Review deletion" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Subject offerings (3)")).toBeInTheDocument();
  expect(screen.getByText("Class meetings (2)")).toBeInTheDocument();
  expect(
    screen.getByText(/Shared faculty, subjects, programs/),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Delete 7 records" }),
  ).toBeDisabled();
  expect(commit).not.toHaveBeenCalled();
  await user.click(screen.getByRole("checkbox", { name: /I reviewed/ }));
  await user.click(screen.getByRole("button", { name: "Delete 7 records" }));
  expect(commit).toHaveBeenCalledOnce();
  const next = commit.mock.calls[0][0];
  expect(next.semesters.map((s: { id: string }) => s.id)).toEqual(["term2"]);
  expect(next.offerings).toHaveLength(0);
  expect(next.faculty).toEqual(data.faculty);
  expect(next.subjects).toEqual(data.subjects);
});

it("supports bulk selection and cancellation without deleting any records", async () => {
  const user = userEvent.setup(),
    commit = vi.fn().mockResolvedValue(true);
  render(
    <Records data={sampleData()} commit={commit} initialEntity="subjects" />,
  );
  await user.click(
    screen.getByRole("checkbox", { name: "Select all visible records" }),
  );
  await user.click(screen.getByRole("button", { name: "Delete selected" }));
  expect(screen.getByText("Subjects (3)")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Delete 9 records" }),
  ).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(commit).not.toHaveBeenCalled();
  expect(
    screen.queryByRole("heading", { name: "Review deletion" }),
  ).not.toBeInTheDocument();
});

it("blocks stale previews and requires another review after records change", async () => {
  const user = userEvent.setup(),
    commit = vi.fn().mockResolvedValue(true),
    data = sampleData();
  const view = render(
    <Records data={data} commit={commit} initialEntity="semesters" />,
  );
  await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
  await user.click(screen.getByRole("checkbox", { name: /I reviewed/ }));
  view.rerender(
    <Records
      data={structuredClone(data)}
      commit={commit}
      initialEntity="semesters"
    />,
  );
  expect(
    screen.getByRole("button", { name: "Delete 7 records" }),
  ).toBeDisabled();
  await user.click(
    screen.getByRole("button", { name: "Review changes again" }),
  );
  expect(
    screen.getByRole("checkbox", { name: /I reviewed/ }),
  ).not.toBeChecked();
  expect(commit).not.toHaveBeenCalled();
});

it("offers a reviewed reset for required rules instead of a delete button", async () => {
  const user = userEvent.setup(),
    commit = vi.fn().mockResolvedValue(true),
    data = sampleData();
  data.workloadRules[0].labFactor = 0.5;
  render(<Records data={data} commit={commit} initialEntity="workloadRules" />);
  expect(
    screen.queryByRole("button", { name: "Delete" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Reset to defaults" }));
  expect(
    screen.getByRole("heading", { name: "Review rule reset" }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("checkbox", { name: /I reviewed/ }));
  await user.click(
    screen.getAllByRole("button", { name: "Reset to defaults" })[0],
  );
  expect(commit.mock.calls[0][0].workloadRules[0].labFactor).toBe(1);
});
