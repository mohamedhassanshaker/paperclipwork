import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { CustomerFormDialog } from "./CustomerFormDialog";
import en from "@/messages/en.json";
import type { Customer } from "@/lib/repository/customer";

function renderDialog(props: Partial<React.ComponentProps<typeof CustomerFormDialog>> = {}) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <CustomerFormDialog open mode="create" onClose={onClose} onSaved={onSaved} {...props} />
    </NextIntlClientProvider>,
  );
  return { onClose, onSaved };
}

describe("CustomerFormDialog", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("blocks submit and shows an inline error for an invalid email, without calling the API", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText("Full name"), "Jane Cooper");
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Create customer" }));

    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("submits valid data to POST /api/customers and reports the saved customer", async () => {
    const created: Customer = {
      id: "new-1",
      name: "Jane Cooper",
      email: "jane@company.com",
      phone: null,
      company: null,
      status: "active",
      createdAt: new Date().toISOString(),
    };
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => created,
    });
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();
    const { onSaved } = renderDialog();

    await user.type(screen.getByLabelText("Full name"), "Jane Cooper");
    await user.type(screen.getByLabelText("Email"), "jane@company.com");
    await user.click(screen.getByRole("button", { name: "Create customer" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(created, "create"));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/customers",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("surfaces a 409 email_taken response as a field-level error", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: "email_taken", message: "taken" }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText("Full name"), "Jane Cooper");
    await user.type(screen.getByLabelText("Email"), "jane@company.com");
    await user.click(screen.getByRole("button", { name: "Create customer" }));

    expect(await screen.findByText("A customer with that email already exists.")).toBeInTheDocument();
  });

  it("pre-fills the form from the customer prop in edit mode and submits a PATCH", async () => {
    const existing: Customer = {
      id: "cust-1",
      name: "Omar Haddad",
      email: "omar@alfanar.ae",
      phone: "+971 50 123 4567",
      company: "Alfanar",
      status: "active",
      createdAt: new Date().toISOString(),
    };
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => existing });
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();
    renderDialog({ mode: "edit", customer: existing });

    expect(screen.getByLabelText("Full name")).toHaveValue("Omar Haddad");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith("/api/customers/cust-1", expect.objectContaining({ method: "PATCH" })),
    );
  });
});
