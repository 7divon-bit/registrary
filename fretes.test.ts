import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock DB helpers
vi.mock("./db", () => ({
  createFrete: vi.fn().mockResolvedValue({ insertId: 42 }),
  getFretesByCity: vi.fn().mockResolvedValue([
    {
      id: 1,
      clientId: 10,
      driverId: null,
      origem: "Rua A, 100",
      destino: "Rua B, 200",
      valor: "150.00",
      status: "OPEN",
      cidade: "São Paulo",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  getFretesByClient: vi.fn().mockResolvedValue([]),
  getFretesByDriver: vi.fn().mockResolvedValue([]),
  getFreteById: vi.fn().mockResolvedValue({
    id: 1,
    clientId: 10,
    driverId: 20,
    origem: "Rua A",
    destino: "Rua B",
    valor: "200.00",
    status: "ASSIGNED",
    cidade: "São Paulo",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  acceptFrete: vi.fn().mockResolvedValue(true),
  completeFrete: vi.fn().mockResolvedValue(undefined),
  createPayment: vi.fn().mockResolvedValue({ insertId: 1 }),
  getPaymentByFreteId: vi.fn().mockResolvedValue(null),
  updateUserProfile: vi.fn().mockResolvedValue(undefined),
  getAllFretes: vi.fn().mockResolvedValue([]),
  getAllUsers: vi.fn().mockResolvedValue([]),
  getAllPayments: vi.fn().mockResolvedValue([]),
  updatePaymentStatus: vi.fn().mockResolvedValue(undefined),
}));

function makeCtx(overrides: Partial<TrpcContext["user"]> = {}): TrpcContext {
  return {
    user: {
      id: 10,
      openId: "test-user",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "manus",
      role: "user",
      userType: "CLIENT",
      phone: null,
      cidade: "São Paulo",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      ...overrides,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── COMMISSION CALCULATION ──────────────────────────────────────────────────

describe("Commission calculation", () => {
  it("calculates 5% commission correctly", () => {
    const valor = 200;
    const commission = parseFloat((valor * 0.05).toFixed(2));
    const driverAmount = parseFloat((valor - commission).toFixed(2));

    expect(commission).toBe(10);
    expect(driverAmount).toBe(190);
  });

  it("handles decimal values correctly", () => {
    const valor = 133.33;
    const commission = parseFloat((valor * 0.05).toFixed(2));
    const driverAmount = parseFloat((valor - commission).toFixed(2));

    expect(commission).toBe(6.67);
    expect(driverAmount).toBe(126.66);
  });

  it("commission + driverAmount equals total", () => {
    const valor = 500;
    const commission = parseFloat((valor * 0.05).toFixed(2));
    const driverAmount = parseFloat((valor - commission).toFixed(2));

    expect(commission + driverAmount).toBeCloseTo(valor, 1);
  });
});

// ─── FRETES ROUTER ───────────────────────────────────────────────────────────

describe("fretes.create", () => {
  it("creates a frete for a CLIENT user", async () => {
    const ctx = makeCtx({ userType: "CLIENT" });
    const caller = appRouter.createCaller(ctx);

    const result = await caller.fretes.create({
      origem: "Rua A, 100",
      destino: "Rua B, 200",
      valor: 150,
      cidade: "São Paulo",
    });

    expect(result).toHaveProperty("id");
  });

  it("rejects frete creation for DRIVER users", async () => {
    const ctx = makeCtx({ userType: "DRIVER" });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.fretes.create({
        origem: "Rua A",
        destino: "Rua B",
        valor: 100,
        cidade: "São Paulo",
      })
    ).rejects.toThrow();
  });
});

describe("fretes.listOpen", () => {
  it("returns open fretes for DRIVER users", async () => {
    const ctx = makeCtx({ userType: "DRIVER" });
    const caller = appRouter.createCaller(ctx);

    const result = await caller.fretes.listOpen({ cidade: "São Paulo" });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].status).toBe("OPEN");
  });

  it("rejects listOpen for CLIENT users", async () => {
    const ctx = makeCtx({ userType: "CLIENT" });
    const caller = appRouter.createCaller(ctx);

    await expect(caller.fretes.listOpen({ cidade: "São Paulo" })).rejects.toThrow();
  });
});

describe("fretes.accept", () => {
  it("allows DRIVER to accept a frete", async () => {
    const ctx = makeCtx({ userType: "DRIVER", id: 20 });
    const caller = appRouter.createCaller(ctx);

    const result = await caller.fretes.accept({ freteId: 1 });

    expect(result.success).toBe(true);
  });
});

describe("fretes.complete", () => {
  it("allows the assigned driver to complete a frete", async () => {
    const ctx = makeCtx({ userType: "DRIVER", id: 20 });
    const caller = appRouter.createCaller(ctx);

    const result = await caller.fretes.complete({ freteId: 1 });

    expect(result.success).toBe(true);
    expect(result.commission).toBe(10);
    expect(result.driverAmount).toBe(190);
    expect(result.total).toBe(200);
  });
});

// ─── ADMIN ROUTER ────────────────────────────────────────────────────────────

describe("admin.listFretes", () => {
  it("allows admin to list all fretes", async () => {
    const ctx = makeCtx({ role: "admin" });
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.listFretes();

    expect(Array.isArray(result)).toBe(true);
  });

  it("rejects non-admin access", async () => {
    const ctx = makeCtx({ role: "user" });
    const caller = appRouter.createCaller(ctx);

    await expect(caller.admin.listFretes()).rejects.toThrow();
  });
});
