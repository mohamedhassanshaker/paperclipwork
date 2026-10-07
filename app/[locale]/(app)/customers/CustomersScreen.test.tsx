import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { ToastProvider } from "@/components/ui/Toast";
import type { Customer } from "@/lib/repository/customer";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
  usePathname: () => "/customers",
}));

import { CustomersScreen } from "./CustomersScreen";

const CUSTOMERS: Customer[] = [
  {
    id: "1",
    name: "Jane Cooper",
    email: "jane.cooper@northwind.com",
    phone: "+1 555 0142",
    company: "Northwind",
    status: "active",
    createdAt: new Date().toISOString(),
  },
  {
    id: "2",
    name: "Priya Nair",
    email: "priya.nair@lumen.io",
    phone: "+44 20 7946 0958",
    company: "Lumen",
    status: "inactive",
    createdAt: new Date().toISOString(),
  },
];

function renderScreen(props: Partial<React.ComponentProps<typeof CustomersScreen>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ToastProvider>
        <CustomersScreen
          initialItems={CUSTOMERS}
          total={CUSTOMERS.length}
          totalAll={CUSTOMERS.length}
          initialQuery=""
          page={1}
          totalPages={1}
          {...props}
        />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

describe("CustomersScreen — table", () => {
  afterEach(() => {
    replace.mockClear();
    refresh.mockClear();
    vi.useRealTimers();
  });

  it("renders a row per customer with the phone column forced ltr", () => {
    renderScreen();
    expect(screen.getByText("Jane Cooper")).toBeInTheDocument();
    expect(screen.getByText("jane.cooper@northwind.com")).toBeInTheDocument();
    const phone = screen.getByText("+1 555 0142");
    expect(phone).toHaveAttribute("dir", "ltr");
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("renders the '{shown} of {total} customers' count", () => {
    renderScreen({ total: 2, totalAll: 5 });
    expect(screen.getByText("2 of 5 customers")).toBeInTheDocument();
  });

  it("shows the empty state when there are no rows", () => {
    renderScreen({ initialItems: [], total: 0, totalAll: 0 });
    expect(screen.getByText("No customers found")).toBeInTheDocument();
    expect(screen.getByText("Try a different search or add a new customer.")).toBeInTheDocument();
  });
});

describe("CustomersScreen — search", () => {
  afterEach(() => {
    replace.mockClear();
    refresh.mockClear();
    vi.useRealTimers();
  });

  it("debounces search input and navigates with the q query param", () => {
    vi.useFakeTimers();
    renderScreen();

    const input = screen.getByPlaceholderText("Search name, email or company…");
    fireEvent.change(input, { target: { value: "omar" } });

    expect(replace).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(replace).toHaveBeenCalledWith("/customers?q=omar");
  });

  it("navigates back to the bare path when the search is cleared", () => {
    vi.useFakeTimers();
    renderScreen({ initialQuery: "omar" });

    const input = screen.getByPlaceholderText("Search name, email or company…");
    fireEvent.change(input, { target: { value: "" } });
    vi.advanceTimersByTime(300);

    expect(replace).toHaveBeenCalledWith("/customers");
  });

  it("does not clobber further typing with a stale server round-trip", () => {
    vi.useFakeTimers();
    const { rerender } = renderScreen({ initialQuery: "" });

    const input = screen.getByPlaceholderText(
      "Search name, email or company…",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "om" } });
    vi.advanceTimersByTime(300);
    expect(replace).toHaveBeenCalledWith("/customers?q=om");

    // user keeps typing before the server round-trip for "om" lands
    fireEvent.change(input, { target: { value: "omar" } });

    // the stale response for "om" now arrives as a prop update
    rerender(
      <NextIntlClientProvider locale="en" messages={en}>
        <ToastProvider>
          <CustomersScreen
            initialItems={CUSTOMERS}
            total={CUSTOMERS.length}
            totalAll={CUSTOMERS.length}
            initialQuery="om"
            page={1}
            totalPages={1}
          />
        </ToastProvider>
      </NextIntlClientProvider>,
    );

    expect(input.value).toBe("omar");
  });
});

describe("CustomersScreen — pagination", () => {
  afterEach(() => {
    replace.mockClear();
    refresh.mockClear();
  });

  it("hides pagination controls when there is only one page", () => {
    renderScreen({ totalPages: 1 });
    expect(screen.queryByText("Next")).not.toBeInTheDocument();
  });

  it("navigates with the page query param, preserving the active search", () => {
    renderScreen({ initialQuery: "omar", page: 1, totalPages: 3 });

    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(replace).toHaveBeenCalledWith("/customers?q=omar&page=2");
  });
});

describe("CustomersScreen — dialogs", () => {
  afterEach(() => {
    replace.mockClear();
    refresh.mockClear();
  });

  it("opens the create dialog from the Add customer button", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole("button", { name: "+ Add customer" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Add customer")).toBeInTheDocument();
  });

  it("opens the delete confirmation with the customer's name interpolated", async () => {
    const user = userEvent.setup();
    renderScreen();

    const [deleteButton] = screen.getAllByRole("button", { name: "Delete" });
    await user.click(deleteButton);

    expect(
      screen.getByText("This permanently removes Jane Cooper. This action cannot be undone."),
    ).toBeInTheDocument();
  });
});
