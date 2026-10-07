import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders a filled pill for the active tone", () => {
    render(<Badge tone="active">Active</Badge>);
    expect(screen.getByText("Active")).toHaveClass("bg-primary", "rounded-pill");
  });

  it("renders an outlined pill for the inactive tone", () => {
    render(<Badge tone="inactive">Inactive</Badge>);
    expect(screen.getByText("Inactive")).toHaveClass("border-border", "rounded-pill");
  });
});
