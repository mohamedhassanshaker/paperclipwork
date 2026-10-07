import { describe, expect, it } from "vitest";
import { routing } from "./routing";

describe("routing", () => {
  it("persists the locale preference in a cookie, not localStorage", () => {
    expect(routing.localeCookie).toMatchObject({
      name: "NEXT_LOCALE",
      sameSite: "lax",
    });
  });
});
