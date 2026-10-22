import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { discardDraft, draftList, useDraft } from "./drafts";
function Form() {
  const d = useDraft(
    "test-draft",
    { name: "" },
    "Academic form",
    "#settings/faculty",
  );
  return (
    <>
      <label>
        Name
        <input
          value={d.value.name}
          onChange={(e) => d.setValue({ name: e.target.value })}
        />
      </label>
      <button onClick={() => d.clear()}>Discard</button>
    </>
  );
}
it("keeps unfinished edits through unmount/remount without treating them as saved records", async () => {
  const user = userEvent.setup();
  const view = render(<Form />);
  await user.type(screen.getByLabelText("Name"), "An unfinished name");
  expect(draftList()).toEqual([
    { key: "test-draft", label: "Academic form", href: "#settings/faculty" },
  ]);
  view.unmount();
  render(<Form />);
  expect(screen.getByLabelText("Name")).toHaveValue("An unfinished name");
  await user.click(screen.getByRole("button", { name: "Discard" }));
  expect(draftList()).toEqual([]);
});

it("allows discarding a draft even if its original record was removed", async () => {
  const user = userEvent.setup();
  render(<Form />);
  await user.type(screen.getByLabelText("Name"), "Unfinished");
  act(() => discardDraft("test-draft"));
  expect(screen.getByLabelText("Name")).toHaveValue("");
  expect(draftList()).toEqual([]);
});
