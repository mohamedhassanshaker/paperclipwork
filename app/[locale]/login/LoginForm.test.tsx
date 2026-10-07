import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";

const messages: Record<string, string> = {
  signIn: "Sign in",
  loginSub: "Enter your credentials to manage customers.",
  email: "Email",
  password: "Password",
  demo: "Sign in with the seeded admin account.",
  errEmail: "Enter a valid email address.",
  errPassword: "Password must be at least 8 characters.",
  "auth.rateLimited": "Too many sign-in attempts. Try again in a few minutes.",
};

const push = vi.fn();
const refresh = vi.fn();
const signIn = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => messages[key] ?? key,
  useLocale: () => "en",
}));

vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => signIn(...args),
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

describe("LoginForm", () => {
  beforeEach(() => {
    push.mockClear();
    refresh.mockClear();
    signIn.mockClear();
  });

  it("opts out of native HTML5 validation so our styled error path is reachable", () => {
    const { container } = render(<LoginForm />);
    expect(container.querySelector("form")).toHaveAttribute("novalidate");
  });

  it("renders the styled malformed-email error when submitted via a real click, not a native browser tooltip", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), "whatever-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter a valid email address.",
    );
    expect(signIn).not.toHaveBeenCalled();
  });
});
