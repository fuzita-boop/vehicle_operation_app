import { eq, and, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, drivers, vehicles, monthlyCycles, dailyRecords, pushSubscriptions } from "../drizzle/schema";
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

  // userId + cycleStartDate の組み合わせで一意判定（driverId/vehicleIdの変更に対応）
  // Date型をYYYY-MM-DD文字列に変換して比較（タイムゾーンズれ防止）
  const startStr = `${cycleStartDate.getUTCFullYear()}-${String(cycleStartDate.getUTCMonth()+1).padStart(2,'0')}-${String(cycleStartDate.getUTCDate()).padStart(2,'0')}`;
  const allCycles = await db
    .select()
    .from(monthlyCycles)
    .where(eq(monthlyCycles.userId, userId));
  const existing = allCycles.filter((c: any) => {
    const d = c.cycleStartDate;
    const s = d instanceof Date
      ? `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`
      : String(d).split('T')[0];
    return s === startStr;
  });

  if (existing.length > 0) {
    // driverId/vehicleIdが変わっていれば更新する
    const current = existing[0];
    if (current.driverId !== driverId || current.vehicleId !== vehicleId) {
      await db.update(monthlyCycles)
        .set({ driverId, vehicleId, cycleEndDate })
        .where(eq(monthlyCycles.id, current.id));
      return { ...current, driverId, vehicleId, cycleEndDate };
    }
    return current;
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

  return await db
    .select()
    .from(dailyRecords)
    .where(eq(dailyRecords.cycleId, cycleId))
    .orderBy(asc(dailyRecords.recordDate));
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

/**
 * Push購読情報を保存（同一ユーザー・同一エンドポイントは上書き）
 */
export async function savePushSubscription(userId: number, endpoint: string, p256dh: string, auth: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
    .limit(1);

  if (existing.length > 0) {
    await db.update(pushSubscriptions)
      .set({ p256dh, auth })
      .where(eq(pushSubscriptions.id, existing[0].id));
    return existing[0].id;
  }

  const result = await db.insert(pushSubscriptions).values({ userId, endpoint, p256dh, auth });
  return result[0].insertId;
}

/**
 * Push購読情報を削除
 */
export async function deletePushSubscription(userId: number, endpoint: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}

/**
 * 全ユーザーのPush購読情報を取得（スケジューラー用）
 */
export async function getAllPushSubscriptions() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(pushSubscriptions);
}

/**
 * 特定ユーザーのPush購読情報を取得
 */
export async function getPushSubscriptionsByUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
}

/**
 * 全ユーザーの帰着未入力件数を取得（スケジューラー用）
 * userId => count のマップを返す
 */
export async function getIncompleteArrivalsByUser(): Promise<Map<number, number>> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const today = new Date();
  const day = today.getDate();
  let cycleStart: Date, cycleEnd: Date;
  if (day >= 16) {
    cycleStart = new Date(today.getFullYear(), today.getMonth(), 16);
    cycleEnd = new Date(today.getFullYear(), today.getMonth() + 1, 15);
  } else {
    cycleStart = new Date(today.getFullYear(), today.getMonth() - 1, 16);
    cycleEnd = new Date(today.getFullYear(), today.getMonth(), 15);
  }

  // 現在サイクルの全サイクルを取得
  const cycles = await db
    .select()
    .from(monthlyCycles)
    .where(
      and(
        eq(monthlyCycles.cycleStartDate, cycleStart),
        eq(monthlyCycles.cycleEndDate, cycleEnd)
      )
    );

  const result = new Map<number, number>();
  for (const cycle of cycles) {
    const records = await db.select().from(dailyRecords).where(eq(dailyRecords.cycleId, cycle.id));
    const incompleteCount = records.filter((r) => r.arrivalTime == null).length;
    if (incompleteCount > 0) {
      result.set(cycle.userId, (result.get(cycle.userId) ?? 0) + incompleteCount);
    }
  }
  return result;
}
