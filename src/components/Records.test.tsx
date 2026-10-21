import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { Records } from "./Records";
import { sampleData } from "../lib/sample";
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
