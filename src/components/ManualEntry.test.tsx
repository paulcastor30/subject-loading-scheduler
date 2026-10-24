import { useState } from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { sampleData } from "../../tests/fixtures/academicData";
import { emptyData, type Data } from "../lib/model";
import { checkData } from "../lib/storage";
import { Dashboard } from "./Dashboard";
import { Records } from "./Records";

it("protects entered fields while a save is pending and restores them after failure", async () => {
  const user = userEvent.setup();
  let finish!: (success: boolean) => void;
  render(
    <Records
      data={sampleData()}
      initialEntity="faculty"
      commit={() =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        })
      }
    />,
  );
  await user.click(screen.getByRole("button", { name: "+ Add record" }));
  await user.type(screen.getByLabelText("Name"), "Pending instructor");
  await user.click(
    screen.getByRole("button", { name: "Save and add another" }),
  );
  expect(screen.getByLabelText("Name")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  await act(async () => finish(false));
  expect(screen.getByLabelText("Name")).toBeEnabled();
  expect(screen.getByLabelText("Name")).toHaveValue("Pending instructor");
});

it("guides an empty workspace to manual semester setup before adding classes", async () => {
  const user = userEvent.setup();
  render(
    <Dashboard
      data={emptyData()}
      term=""
      navigate={vi.fn()}
      commit={vi.fn()}
      onTerm={vi.fn()}
    />,
  );
  const guide = screen.getByRole("region", { name: "Your next step" });
  expect(
    within(guide).getByRole("heading", { name: "Create your semester" }),
  ).toBeVisible();
  await user.click(
    within(guide).getByRole("button", { name: "Set up semester" }),
  );
  expect(screen.getByLabelText("Academic year")).toBeVisible();
});

it("takes manual entry users directly to missing subjects before suggesting classes", async () => {
  const user = userEvent.setup(),
    data = sampleData(),
    navigate = vi.fn();
  data.subjects = [];
  data.offerings = [];
  data.assignments = [];
  data.meetings = [];
  render(
    <Dashboard
      data={data}
      term="term1"
      navigate={navigate}
      commit={vi.fn()}
      onTerm={vi.fn()}
    />,
  );
  const guide = screen.getByRole("region", { name: "Your next step" });
  await user.click(within(guide).getByRole("button", { name: "Add subjects" }));
  expect(navigate).toHaveBeenCalledWith("settings", "subjects?record=new");
});

it("does not trap fully scheduled classes behind specialization advice", () => {
  const data = sampleData();
  data.offerings = data.offerings.slice(0, 1);
  data.faculty[0].specialization = "Unrelated specialty";
  render(
    <Dashboard
      data={data}
      term="term1"
      navigate={vi.fn()}
      commit={vi.fn()}
      onTerm={vi.fn()}
    />,
  );
  expect(
    within(screen.getByRole("region", { name: "Your next step" })).getByRole(
      "button",
      { name: "Review and print reports" },
    ),
  ).toBeVisible();
});

function SubjectRecords({
  fail = false,
  initial,
}: {
  fail?: boolean;
  initial?: Data;
}) {
  const [data, setData] = useState(() => initial ?? sampleData());
  return (
    <Records
      data={data}
      initialEntity="subjects"
      commit={async (next) => {
        if (fail) return false;
        setData(checkData(next));
        return true;
      }}
    />
  );
}

it("retains a deliberately chosen curriculum when several versions exist", async () => {
  const data = sampleData(),
    user = userEvent.setup();
  data.curricula.push({
    id: "curr2",
    name: "Revised curriculum",
    programId: "program1",
  });
  render(<SubjectRecords initial={data} />);
  await user.click(screen.getByRole("button", { name: "+ Add record" }));
  await user.selectOptions(screen.getByLabelText("Curriculum"), "curr2");
  await user.type(screen.getByLabelText("Name"), "Networks");
  await user.type(screen.getByLabelText("Code"), "CS 302");
  await user.click(
    screen.getByRole("button", { name: "Save and add another" }),
  );
  expect(screen.getByLabelText("Curriculum")).toHaveValue("curr2");
  expect(screen.getByLabelText("Name")).toHaveValue("");
  expect(screen.getByLabelText("Code")).toHaveValue("");
  expect(screen.getByRole("row", { name: /CS 302/ })).toHaveTextContent(
    "Revised curriculum",
  );
});

it("saves successive subjects with new identities and retained curriculum", async () => {
  const user = userEvent.setup();
  render(<SubjectRecords />);
  await user.click(screen.getByRole("button", { name: "+ Add record" }));
  expect(screen.getByText(/Curriculum: Sample curriculum/)).toBeVisible();
  expect(screen.getByLabelText("Equipment")).not.toBeVisible();
  await user.type(screen.getByLabelText("Name"), "Algorithms");
  await user.type(screen.getByLabelText("Code"), "CS 301");
  await user.click(
    screen.getByRole("button", { name: "Save and add another" }),
  );
  expect(screen.getByLabelText("Name")).toHaveValue("");
  expect(screen.getByLabelText("Name")).toHaveFocus();
  expect(screen.getByLabelText("Code")).toHaveValue("");
  expect(screen.getByText(/Saved Algorithms/)).toBeVisible();
  await user.type(screen.getByLabelText("Name"), "Networks");
  await user.type(screen.getByLabelText("Code"), "CS 302");
  await user.click(screen.getByRole("button", { name: "Save record" }));
  expect(
    screen.queryByRole("button", { name: "Save record" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("row", { name: /CS 301/ })).toBeVisible();
  expect(screen.getByRole("row", { name: /CS 302/ })).toBeVisible();
});

it("keeps subject details when save and add another fails", async () => {
  const user = userEvent.setup();
  render(<SubjectRecords fail />);
  await user.click(screen.getByRole("button", { name: "+ Add record" }));
  await user.type(screen.getByLabelText("Name"), "Algorithms");
  await user.type(screen.getByLabelText("Code"), "CS 301");
  await user.click(
    screen.getByRole("button", { name: "Save and add another" }),
  );
  expect(screen.getByLabelText("Name")).toHaveValue("Algorithms");
  expect(screen.getByLabelText("Code")).toHaveValue("CS 301");
  expect(screen.getByRole("alert")).toHaveTextContent(/not saved/i);
});
