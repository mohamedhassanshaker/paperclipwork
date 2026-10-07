import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ToastProvider, useToast } from "./Toast";

function Trigger() {
  const { showToast } = useToast();
  return (
    <button onClick={() => showToast("Customer created")}>Create</button>
  );
}

describe("Toast", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the message and auto-dismisses after 2200ms", () => {
    vi.useFakeTimers();

    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(screen.getByRole("status")).toHaveTextContent("Customer created");

    act(() => {
      vi.advanceTimersByTime(2200);
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
