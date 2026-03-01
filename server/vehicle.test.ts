import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getOrCreateDriver: vi.fn(),
  getOrCreateVehicle: vi.fn(),
  getOrCreateMonthlyCycle: vi.fn(),
  addDailyRecord: vi.fn(),
  getDailyRecordsByCycle: vi.fn(),
  updateDailyRecord: vi.fn(),
  deleteDailyRecord: vi.fn(),
  updateDriver: vi.fn(),
  updateVehicle: vi.fn(),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("vehicle.updateRecord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls updateDailyRecord with correct parameters", async () => {
    const mockUpdateDailyRecord = vi.mocked(db.updateDailyRecord);
    mockUpdateDailyRecord.mockResolvedValue(undefined as any);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.vehicle.updateRecord({
      recordId: 1,
      recordDate: "2026-02-20",
      departureTime: "08:00",
      arrivalTime: "17:00",
      departureDistance: 100,
      arrivalDistance: 150,
    });

    expect(result).toEqual({ success: true });
    expect(mockUpdateDailyRecord).toHaveBeenCalledWith(1, {
      recordDate: "2026-02-20",
      departureTime: "08:00",
      arrivalTime: "17:00",
      departureDistance: 100,
      arrivalDistance: 150,
    });
  });

  it("handles partial updates", async () => {
    const mockUpdateDailyRecord = vi.mocked(db.updateDailyRecord);
    mockUpdateDailyRecord.mockResolvedValue(undefined as any);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.vehicle.updateRecord({
      recordId: 2,
      departureTime: "09:00",
    });

    expect(result).toEqual({ success: true });
    expect(mockUpdateDailyRecord).toHaveBeenCalledWith(2, {
      departureTime: "09:00",
    });
  });
});

describe("vehicle.deleteRecord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls deleteDailyRecord with correct recordId", async () => {
    const mockDeleteDailyRecord = vi.mocked(db.deleteDailyRecord);
    mockDeleteDailyRecord.mockResolvedValue(undefined as any);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.vehicle.deleteRecord({ recordId: 5 });

    expect(result).toEqual({ success: true });
    expect(mockDeleteDailyRecord).toHaveBeenCalledWith(5);
  });
});

describe("vehicle.addRecord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls addDailyRecord with correct parameters", async () => {
    const mockAddDailyRecord = vi.mocked(db.addDailyRecord);
    mockAddDailyRecord.mockResolvedValue({ insertId: 1 } as any);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.vehicle.addRecord({
      cycleId: 1,
      recordDate: "2026-02-20",
      departureTime: "08:00",
      arrivalTime: "17:00",
      departureDistance: 100,
      arrivalDistance: 150,
    });

    expect(mockAddDailyRecord).toHaveBeenCalledWith(
      1,
      "2026-02-20",
      "08:00",
      "17:00",
      100,
      150
    );
  });
});
