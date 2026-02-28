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
      arrivalTime: string;
      departureDistance: number;
      arrivalDistance: number;
    }).mutation(async ({ input }) => {
      const { addDailyRecord } = await import("./db");
      const recordDate = new Date(input.recordDate);
      return await addDailyRecord(
        input.cycleId,
        recordDate,
        input.departureTime,
        input.arrivalTime,
        input.departureDistance,
        input.arrivalDistance
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
      if (input.recordDate !== undefined) data.recordDate = new Date(input.recordDate);
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
  }),
});

export type AppRouter = typeof appRouter;
