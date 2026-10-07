import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "./Input";

describe("Input", () => {
  it("accepts typed text", async () => {
    render(<Input aria-label="Email" />);
    const input = screen.getByLabelText("Email");

    await userEvent.type(input, "jane@company.com");

    expect(input).toHaveValue("jane@company.com");
  });

  it("carries the visible focus-ring utility for keyboard users", () => {
    render(<Input aria-label="Email" />);
    expect(screen.getByLabelText("Email")).toHaveClass("focus-ring");
  });
});
