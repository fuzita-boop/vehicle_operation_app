import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, drivers, vehicles, monthlyCycles, dailyRecords } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * 運転者情報の取得または作成
 */
export async function getOrCreateDriver(userId: number, driverName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(drivers)
    .where(eq(drivers.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const result = await db.insert(drivers).values({ userId, driverName });
  return { id: result[0].insertId, userId, driverName, createdAt: new Date(), updatedAt: new Date() };
}

/**
 * 車両情報の取得または作成
 */
export async function getOrCreateVehicle(userId: number, vehicleNumber: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const result = await db.insert(vehicles).values({ userId, vehicleNumber });
  return { id: result[0].insertId, userId, vehicleNumber, createdAt: new Date(), updatedAt: new Date() };
}

/**
 * 月次サイクルの取得または作成
 */
export async function getOrCreateMonthlyCycle(userId: number, driverId: number, vehicleId: number, cycleStartDate: Date, cycleEndDate: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(monthlyCycles)
    .where(
      and(
        eq(monthlyCycles.userId, userId),
        eq(monthlyCycles.driverId, driverId),
        eq(monthlyCycles.vehicleId, vehicleId),
        eq(monthlyCycles.cycleStartDate, cycleStartDate),
        eq(monthlyCycles.cycleEndDate, cycleEndDate)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const result = await db.insert(monthlyCycles).values({
    userId,
    driverId,
    vehicleId,
    cycleStartDate,
    cycleEndDate,
  });
  return { id: result[0].insertId, userId, driverId, vehicleId, cycleStartDate, cycleEndDate, createdAt: new Date(), updatedAt: new Date() };
}

/**
 * 日次記録の追加
 */
/** Parse YYYY-MM-DD to Date at noon UTC to avoid timezone day-shift */
function parseDateString(dateStr: string): Date {
  // Split the string to avoid timezone interpretation
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export async function addDailyRecord(
  cycleId: number,
  recordDate: string,
  departureTime: string,
  arrivalTime: string | null,
  departureDistance: number,
  arrivalDistance: number | null
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(dailyRecords).values({
    cycleId,
    recordDate: parseDateString(recordDate),
    departureTime,
    arrivalTime: arrivalTime ?? undefined,
    departureDistance: departureDistance.toString(),
    arrivalDistance: arrivalDistance != null ? arrivalDistance.toString() : undefined,
  });

  return result[0];
}

/**
 * 月次サイクル内の日次記録を取得
 */
export async function getDailyRecordsByCycle(cycleId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(dailyRecords).where(eq(dailyRecords.cycleId, cycleId));
}

/**
 * 運転者情報を更新
 */
export async function updateDriver(driverId: number, driverName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(drivers).set({ driverName }).where(eq(drivers.id, driverId));
}

/**
 * 車両情報を更新
 */
export async function updateVehicle(vehicleId: number, vehicleNumber: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(vehicles).set({ vehicleNumber }).where(eq(vehicles.id, vehicleId));
}

/**
 * 日次記録を更新
 */
export async function updateDailyRecord(
  recordId: number,
  data: {
    recordDate?: string;
    departureTime?: string;
    arrivalTime?: string | null;
    departureDistance?: number;
    arrivalDistance?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateSet: Record<string, unknown> = {};
  if (data.recordDate !== undefined) updateSet.recordDate = parseDateString(data.recordDate);
  if (data.departureTime !== undefined) updateSet.departureTime = data.departureTime;
  if (data.arrivalTime !== undefined) updateSet.arrivalTime = data.arrivalTime;
  if (data.departureDistance !== undefined) updateSet.departureDistance = data.departureDistance.toString();
  if (data.arrivalDistance !== undefined) updateSet.arrivalDistance = data.arrivalDistance != null ? data.arrivalDistance.toString() : null;

  return await db.update(dailyRecords).set(updateSet).where(eq(dailyRecords.id, recordId));
}

/**
 * ユーザーの全サイクル一覧を取得（新しい順）
 */
export async function getAllCycles(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select()
    .from(monthlyCycles)
    .where(eq(monthlyCycles.userId, userId))
    .orderBy(monthlyCycles.cycleStartDate);
}

/**
 * 日次記録を削除
 */
export async function deleteDailyRecord(recordId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(dailyRecords).where(eq(dailyRecords.id, recordId));
}
