import { afterEach, describe, expect, it, vi } from "vitest";
import { EnsureAdminError } from "../lib/ensure-admin";

const ensureAdminMock = vi.hoisted(() => vi.fn());
vi.mock("../lib/ensure-admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/ensure-admin")>();
  return { ...actual, ensureAdmin: ensureAdminMock };
});
vi.mock("../lib/db", () => ({ prisma: { $disconnect: vi.fn() } }));

const { run } = await import("./ensure-admin");

afterEach(() => {
  vi.clearAllMocks();
});

describe("ensure-admin CLI run()", () => {
  it("exits 0 and logs a skip message when the env is missing", async () => {
    ensureAdminMock.mockResolvedValueOnce({ outcome: "skipped", reason: "missing env" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await run({}, []);

    expect(code).toBe(0);
    expect(ensureAdminMock).toHaveBeenCalledWith({
      email: undefined,
      password: undefined,
      forceReset: false,
    });
    expect(logSpy.mock.calls.join(" ")).toContain("missing env");
  });

  it("passes forceReset through from --force-reset", async () => {
    ensureAdminMock.mockResolvedValueOnce({ outcome: "created", email: "admin@company.com" });
    vi.spyOn(console, "log").mockImplementation(() => {});

    await run(
      { SEED_ADMIN_EMAIL: "admin@company.com", SEED_ADMIN_PASSWORD: "a-strong-password-123" },
      ["--force-reset"],
    );

    expect(ensureAdminMock).toHaveBeenCalledWith(
      expect.objectContaining({ forceReset: true }),
    );
  });

  it("passes forceReset through from ADMIN_FORCE_RESET=1", async () => {
    ensureAdminMock.mockResolvedValueOnce({ outcome: "reset", email: "admin@company.com" });
    vi.spyOn(console, "log").mockImplementation(() => {});

    await run(
      {
        SEED_ADMIN_EMAIL: "admin@company.com",
        SEED_ADMIN_PASSWORD: "a-strong-password-123",
        ADMIN_FORCE_RESET: "1",
      },
      [],
    );

    expect(ensureAdminMock).toHaveBeenCalledWith(
      expect.objectContaining({ forceReset: true }),
    );
  });

  it("masks the email in every logged outcome, never logging the password", async () => {
    const password = "a-strong-password-123";
    const outcomes = [
      { outcome: "created", email: "admin@company.com" },
      { outcome: "unchanged", email: "admin@company.com" },
      { outcome: "reset", email: "admin@company.com" },
    ] as const;

    for (const outcome of outcomes) {
      ensureAdminMock.mockResolvedValueOnce(outcome);
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await run({ SEED_ADMIN_EMAIL: "admin@company.com", SEED_ADMIN_PASSWORD: password }, []);

      const logged = logSpy.mock.calls.flat().join(" ");
      expect(logged).toContain("a***@company.com");
      expect(logged).not.toContain("admin@company.com");
      expect(logged).not.toContain(password);
      logSpy.mockRestore();
    }
  });

  it("exits 1 and logs to stderr, without the password, on EnsureAdminError", async () => {
    const password = "short1";
    ensureAdminMock.mockRejectedValueOnce(new EnsureAdminError("password below the floor"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const code = await run({ SEED_ADMIN_EMAIL: "admin@company.com", SEED_ADMIN_PASSWORD: password }, []);

    expect(code).toBe(1);
    const logged = errorSpy.mock.calls.flat().join(" ");
    expect(logged).toContain("password below the floor");
    expect(logged).not.toContain(password);
  });

  it("exits 1 on an unexpected error", async () => {
    ensureAdminMock.mockRejectedValueOnce(new Error("connect ECONNREFUSED"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const code = await run(
      { SEED_ADMIN_EMAIL: "admin@company.com", SEED_ADMIN_PASSWORD: "a-strong-password-123" },
      [],
    );

    expect(code).toBe(1);
  });
});
