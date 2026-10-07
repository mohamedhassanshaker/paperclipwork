import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "./Select";

describe("Select", () => {
  it("lets the user choose an option", async () => {
    render(
      <Select aria-label="Status" defaultValue="active">
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </Select>,
    );

    const select = screen.getByLabelText("Status");
    await userEvent.selectOptions(select, "inactive");

    expect(select).toHaveValue("inactive");
  });
});
