import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { FacultyLoads } from "./FacultyLoads";
import { sampleData } from "../../tests/fixtures/academicData";

function records() {
  const data = sampleData();
  data.loadActivities.push({
    id: "duty1",
    semesterId: "term1",
    facultyId: "fac1",
    name: "Research coordinator",
    kind: "research",
    credits: 3,
    reference: "Approved order 12",
  });
  return data;
}

it("clears every duty field when switching faculty", async () => {
  const user = userEvent.setup(),
    commit = vi.fn().mockResolvedValue(true);
  render(<FacultyLoads data={records()} term="term1" commit={commit} />);
  await user.click(screen.getByRole("button", { name: "Edit" }));
  expect(screen.getByLabelText("Credited units")).toHaveValue(3);
  await user.selectOptions(screen.getByLabelText("Faculty member"), "fac2");
  expect(screen.getByLabelText("Duty or activity")).toHaveValue("");
  expect(screen.getByLabelText("Credited units")).toHaveValue(0);
  expect(screen.getByLabelText("Category")).toHaveValue("administration");
  expect(
    screen.getByLabelText("Order, approval or source reference"),
  ).toHaveValue("");
  await user.type(screen.getByLabelText("Duty or activity"), "Advising");
  await user.click(screen.getByRole("button", { name: "Save duty" }));
  expect(commit.mock.calls[0][0].loadActivities.at(-1)).toMatchObject({
    facultyId: "fac2",
    credits: 0,
    reference: "",
  });
});

it("clears the edit draft after removing that duty so it cannot be recreated accidentally", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  function Harness() {
    const [data, setData] = useState(records);
    return (
      <FacultyLoads
        data={data}
        term="term1"
        commit={async (next) => {
          setData(next);
          return true;
        }}
      />
    );
  }
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole("button", { name: "Edit" }));
  await user.click(screen.getByRole("button", { name: "Remove" }));
  expect(screen.getByLabelText("Duty or activity")).toHaveValue("");
  expect(screen.getByLabelText("Credited units")).toHaveValue(0);
  expect(
    screen.queryByRole("button", { name: "Cancel edit" }),
  ).not.toBeInTheDocument();
  confirm.mockRestore();
});
