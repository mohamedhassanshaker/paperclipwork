import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog } from "./Dialog";

function Example({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} titleId="dialog-title">
      <h3 id="dialog-title">Delete customer?</h3>
      <button>Cancel</button>
      <button>Delete</button>
    </Dialog>
  );
}

describe("Dialog", () => {
  it("renders nothing when closed", () => {
    render(<Example open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders over a scrim and labels itself for screen readers when open", () => {
    render(<Example open={true} onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "dialog-title");
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(<Example open={true} onClose={onClose} />);

    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("traps Tab focus inside the panel", async () => {
    render(<Example open={true} onClose={vi.fn()} />);

    const cancel = screen.getByRole("button", { name: "Cancel" });
    const del = screen.getByRole("button", { name: "Delete" });

    del.focus();
    expect(del).toHaveFocus();

    await userEvent.tab();
    expect(cancel).toHaveFocus();
  });
});
