import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, date, uniqueIndex } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 運転者テーブル
 * 各ユーザーが登録した運転者情報を保持
 */
export const drivers = mysqlTable("drivers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  driverName: varchar("driverName", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Driver = typeof drivers.$inferSelect;
export type InsertDriver = typeof drivers.$inferInsert;

/**
 * 車両テーブル
 * 各ユーザーが登録した車両情報を保持
 */
export const vehicles = mysqlTable("vehicles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  vehicleNumber: varchar("vehicleNumber", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = typeof vehicles.$inferInsert;

/**
 * 月次サイクルテーブル
 * 毎月16日〜翌15日のサイクルを管理
 */
export const monthlyCycles = mysqlTable("monthlyCycles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  driverId: int("driverId").notNull(),
  vehicleId: int("vehicleId").notNull(),
  cycleStartDate: date("cycleStartDate").notNull(), // 16日
  cycleEndDate: date("cycleEndDate").notNull(), // 翌月15日
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  // 同一ユーザー・同一期間の重複サイクル作成をDBレベルで防止
  userCycleUnique: uniqueIndex("monthlyCycles_userId_cycleStartDate_unique").on(table.userId, table.cycleStartDate),
}));

export type MonthlyCycle = typeof monthlyCycles.$inferSelect;
export type InsertMonthlyCycle = typeof monthlyCycles.$inferInsert;

/**
 * 日次記録テーブル
 * 毎日の運行記録（出発時間、終了時間、走行距離）を保持
 */
export const dailyRecords = mysqlTable("dailyRecords", {
  id: int("id").autoincrement().primaryKey(),
  cycleId: int("cycleId").notNull(),
  recordDate: date("recordDate").notNull(),
  departureTime: varchar("departureTime", { length: 5 }).notNull(), // HH:MM形式
  arrivalTime: varchar("arrivalTime", { length: 5 }), // HH:MM形式（帰着後に入力）
  departureDistance: decimal("departureDistance", { precision: 10, scale: 1 }).notNull(), // 出発時走行距離
  arrivalDistance: decimal("arrivalDistance", { precision: 10, scale: 1 }), // 到着時走行距離（帰着後に入力）
  notes: text("notes"), // 備考欄（任意）
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DailyRecord = typeof dailyRecords.$inferSelect;
export type InsertDailyRecord = typeof dailyRecords.$inferInsert;

/**
 * Web Push購読テーブル
 * ブラウザプッシュ通知の購読情報を保持
 */
export const pushSubscriptions = mysqlTable("pushSubscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;
