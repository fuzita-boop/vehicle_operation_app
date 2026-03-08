import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  push: router({
    subscribe: protectedProcedure.input((val: any) => val as { endpoint: string; p256dh: string; auth: string }).mutation(async ({ ctx, input }) => {
      const { savePushSubscription } = await import("./db");
      await savePushSubscription(ctx.user.id, input.endpoint, input.p256dh, input.auth);
      return { success: true };
    }),
    unsubscribe: protectedProcedure.input((val: any) => val as { endpoint: string }).mutation(async ({ ctx, input }) => {
      const { deletePushSubscription } = await import("./db");
      await deletePushSubscription(ctx.user.id, input.endpoint);
      return { success: true };
    }),
    sendTest: protectedProcedure.mutation(async ({ ctx }) => {
      const { getPushSubscriptionsByUser, deletePushSubscription } = await import("./db");
      const webpush = await import("web-push");
      const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
      const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
      if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        throw new Error("VAPID keys not configured");
      }
      webpush.default.setVapidDetails("mailto:noreply@vehicle-app.local", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
      const subscriptions = await getPushSubscriptionsByUser(ctx.user.id);
      if (subscriptions.length === 0) {
        return { success: false, message: "購読情報がありません。通知を許可してください。" };
      }
      let sent = 0;
      let failed = 0;
      for (const sub of subscriptions) {
        const payload = JSON.stringify({
          title: "車両運行日報 - テスト通知",
          body: "通知のテストです。正常に届いています！",
          url: "/daily-record",
        });
        try {
          await webpush.default.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          sent++;
        } catch (err: any) {
          failed++;
          if (err.statusCode === 410 || err.statusCode === 404) {
            await deletePushSubscription(ctx.user.id, sub.endpoint);
          }
        }
      }
      if (sent > 0) {
        return { success: true, message: "テスト通知を送信しました。" };
      } else {
        return { success: false, message: "購読情報が無効です。一度オフにしてから再度通知を許可してください。" };
      }
    }),
  }),

  vehicle: router({
    getDriver: protectedProcedure.query(async ({ ctx }) => {
      const { getOrCreateDriver } = await import("./db");
      return await getOrCreateDriver(ctx.user.id, "");
    }),
    setDriver: protectedProcedure.input((val: any) => val as { driverName: string }).mutation(async ({ ctx, input }) => {
      const { getOrCreateDriver, updateDriver } = await import("./db");
      const existing = await getOrCreateDriver(ctx.user.id, input.driverName);
      if (existing.id) {
        await updateDriver(existing.id, input.driverName);
      }
      return { success: true, driverId: existing.id };
    }),
    getVehicle: protectedProcedure.query(async ({ ctx }) => {
      const { getOrCreateVehicle } = await import("./db");
      return await getOrCreateVehicle(ctx.user.id, "");
    }),
    setVehicle: protectedProcedure.input((val: any) => val as { vehicleNumber: string }).mutation(async ({ ctx, input }) => {
      const { getOrCreateVehicle, updateVehicle } = await import("./db");
      const existing = await getOrCreateVehicle(ctx.user.id, input.vehicleNumber);
      if (existing.id) {
        await updateVehicle(existing.id, input.vehicleNumber);
      }
      return { success: true, vehicleId: existing.id };
    }),
    getCurrentCycle: protectedProcedure.query(async ({ ctx }) => {
      const { getOrCreateDriver, getOrCreateVehicle, getOrCreateMonthlyCycle } = await import("./db");
      const driver = await getOrCreateDriver(ctx.user.id, "");
      const vehicle = await getOrCreateVehicle(ctx.user.id, "");
      
      if (!driver.id || !vehicle.id) return null;
      
      const today = new Date();
      const day = today.getDate();
      let cycleStart, cycleEnd;
      
      if (day >= 16) {
        cycleStart = new Date(today.getFullYear(), today.getMonth(), 16);
        cycleEnd = new Date(today.getFullYear(), today.getMonth() + 1, 15);
      } else {
        cycleStart = new Date(today.getFullYear(), today.getMonth() - 1, 16);
        cycleEnd = new Date(today.getFullYear(), today.getMonth(), 15);
      }
      
      return await getOrCreateMonthlyCycle(ctx.user.id, driver.id, vehicle.id, cycleStart, cycleEnd);
    }),
    addRecord: protectedProcedure.input((val: any) => val as {
      cycleId: number;
      recordDate: string;
      departureTime: string;
      arrivalTime?: string | null;
      departureDistance: number;
      arrivalDistance?: number | null;
    }).mutation(async ({ input }) => {
      const { addDailyRecord } = await import("./db");
      // Pass YYYY-MM-DD string directly to avoid timezone shift
      return await addDailyRecord(
        input.cycleId,
        input.recordDate,
        input.departureTime,
        input.arrivalTime ?? null,
        input.departureDistance,
        input.arrivalDistance ?? null
      );
    }),
    getRecords: protectedProcedure.input((val: any) => val as { cycleId: number }).query(async ({ input }) => {
      const { getDailyRecordsByCycle } = await import("./db");
      return await getDailyRecordsByCycle(input.cycleId);
    }),
    updateRecord: protectedProcedure.input((val: any) => val as {
      recordId: number;
      recordDate?: string;
      departureTime?: string;
      arrivalTime?: string;
      departureDistance?: number;
      arrivalDistance?: number;
    }).mutation(async ({ input }) => {
      const { updateDailyRecord } = await import("./db");
      const data: any = {};
      // Pass YYYY-MM-DD string directly to avoid timezone shift
      if (input.recordDate !== undefined) data.recordDate = input.recordDate;
      if (input.departureTime !== undefined) data.departureTime = input.departureTime;
      if (input.arrivalTime !== undefined) data.arrivalTime = input.arrivalTime;
      if (input.departureDistance !== undefined) data.departureDistance = input.departureDistance;
      if (input.arrivalDistance !== undefined) data.arrivalDistance = input.arrivalDistance;
      await updateDailyRecord(input.recordId, data);
      return { success: true };
    }),
    deleteRecord: protectedProcedure.input((val: any) => val as { recordId: number }).mutation(async ({ input }) => {
      const { deleteDailyRecord } = await import("./db");
      await deleteDailyRecord(input.recordId);
      return { success: true };
    }),
    getCycles: protectedProcedure.query(async ({ ctx }) => {
      const { getAllCycles } = await import("./db");
      return await getAllCycles(ctx.user.id);
    }),
    getIncompleteCount: protectedProcedure.query(async ({ ctx }) => {
      const { getOrCreateDriver, getOrCreateVehicle, getOrCreateMonthlyCycle, getDailyRecordsByCycle } = await import("./db");
      const driver = await getOrCreateDriver(ctx.user.id, "");
      const vehicle = await getOrCreateVehicle(ctx.user.id, "");
      if (!driver.id || !vehicle.id) return { count: 0 };
      const today = new Date();
      const day = today.getDate();
      let cycleStart, cycleEnd;
      if (day >= 16) {
        cycleStart = new Date(today.getFullYear(), today.getMonth(), 16);
        cycleEnd = new Date(today.getFullYear(), today.getMonth() + 1, 15);
      } else {
        cycleStart = new Date(today.getFullYear(), today.getMonth() - 1, 16);
        cycleEnd = new Date(today.getFullYear(), today.getMonth(), 15);
      }
      const cycle = await getOrCreateMonthlyCycle(ctx.user.id, driver.id, vehicle.id, cycleStart, cycleEnd);
      if (!cycle?.id) return { count: 0 };
      const records = await getDailyRecordsByCycle(cycle.id);
      const count = records.filter((r: any) => r.arrivalTime == null).length;
      return { count };
    }),
  }),
});

export type AppRouter = typeof appRouter;
