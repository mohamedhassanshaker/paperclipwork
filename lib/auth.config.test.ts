import { describe, expect, it } from "vitest";
import { authConfig } from "./auth.config";

describe("authConfig", () => {
  it("uses JWT sessions (required for the Credentials provider) with an 8h expiry", () => {
    expect(authConfig.session?.strategy).toBe("jwt");
    expect(authConfig.session?.maxAge).toBe(60 * 60 * 8);
  });

  it("points unauthenticated users at the login page", () => {
    expect(authConfig.pages?.signIn).toBe("/login");
  });
});
