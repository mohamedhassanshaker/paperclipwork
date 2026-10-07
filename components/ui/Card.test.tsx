import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "./Card";

describe("Card", () => {
  it("renders its children inside the token-styled surface", () => {
    render(<Card>Total customers</Card>);
    const card = screen.getByText("Total customers");

    expect(card).toHaveClass("rounded-card", "border-border", "bg-surface");
  });
});
