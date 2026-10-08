import { afterEach, describe, expect, it, vi } from "vitest";

const ensureAdminMock = vi.hoisted(() => vi.fn());
const upsertMock = vi.hoisted(() => vi.fn());

vi.mock("../lib/ensure-admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/ensure-admin")>();
  return { ...actual, ensureAdmin: ensureAdminMock };
});
vi.mock("../lib/db", () => ({
  prisma: { customer: { upsert: upsertMock }, $disconnect: vi.fn() },
}));

const { run } = await import("./seed");

afterEach(() => {
  delete process.env.ADMIN_FORCE_RESET;
  vi.clearAllMocks();
});

describe("seed run()", () => {
  it("treats ADMIN_FORCE_RESET=1 as inert — only --force-reset can force a reset", async () => {
    process.env.ADMIN_FORCE_RESET = "1";
    ensureAdminMock.mockResolvedValueOnce({ outcome: "unchanged", email: "admin@company.com" });
    vi.spyOn(console, "log").mockImplementation(() => {});

    await run([]);

    expect(ensureAdminMock).toHaveBeenCalledWith(
      expect.objectContaining({ forceReset: false }),
    );
  });

  it("passes forceReset through from --force-reset", async () => {
    ensureAdminMock.mockResolvedValueOnce({ outcome: "created", email: "admin@company.com" });
    vi.spyOn(console, "log").mockImplementation(() => {});

    await run(["--force-reset"]);

    expect(ensureAdminMock).toHaveBeenCalledWith(
      expect.objectContaining({ forceReset: true }),
    );
  });

  it("still seeds the four synthetic customers regardless of admin outcome", async () => {
    ensureAdminMock.mockResolvedValueOnce({ outcome: "skipped", reason: "missing env" });
    vi.spyOn(console, "log").mockImplementation(() => {});

    await run([]);

    expect(upsertMock).toHaveBeenCalledTimes(4);
  });
});
