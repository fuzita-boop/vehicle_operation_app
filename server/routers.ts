import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getCurrentCycleDates, dateStrToNoonUTC, toDateStr } from "../shared/jst";
import { COOKIE_NAME } from "../shared/const";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
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

      // JST基準でサイクル日付を計算（shared/jst.tsに集約）
      const { cycleStartDate, cycleEndDate } = getCurrentCycleDates();

      const cycle = await getOrCreateMonthlyCycle(
        ctx.user.id,
        driver.id,
        vehicle.id,
        dateStrToNoonUTC(cycleStartDate),
        dateStrToNoonUTC(cycleEndDate),
      );

      return {
        ...cycle,
        cycleStartDate,
        cycleEndDate,
      };
    }),

    addRecord: protectedProcedure.input((val: any) => val as {
      cycleId: number;
      recordDate: string;
      departureTime: string;
      arrivalTime?: string | null;
      departureDistance: number;
      arrivalDistance?: number | null;
      jobCount?: number | null;
    }).mutation(async ({ input }) => {
      const { addDailyRecord } = await import("./db");
      return await addDailyRecord(
        input.cycleId,
        input.recordDate,
        input.departureTime,
        input.arrivalTime ?? null,
        input.departureDistance,
        input.arrivalDistance ?? null,
        input.jobCount ?? null
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
      jobCount?: number | null;
    }).mutation(async ({ input }) => {
      const { updateDailyRecord } = await import("./db");
      const data: any = {};
      if (input.recordDate !== undefined) data.recordDate = input.recordDate;
      if (input.departureTime !== undefined) data.departureTime = input.departureTime;
      if (input.arrivalTime !== undefined) data.arrivalTime = input.arrivalTime;
      if (input.departureDistance !== undefined) data.departureDistance = input.departureDistance;
      if (input.arrivalDistance !== undefined) data.arrivalDistance = input.arrivalDistance;
      if (input.jobCount !== undefined) data.jobCount = input.jobCount;
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
      const cycles = await getAllCycles(ctx.user.id);
      // DBから取得した日付をYYYY-MM-DD文字列に正規化（shared/jst.tsのtoDateStrを使用）
      return cycles.map((c: any) => ({
        ...c,
        cycleStartDate: toDateStr(c.cycleStartDate),
        cycleEndDate: toDateStr(c.cycleEndDate),
      }));
    }),

    getIncompleteCount: protectedProcedure.query(async ({ ctx }) => {
      const { getOrCreateDriver, getOrCreateVehicle, getOrCreateMonthlyCycle, getDailyRecordsByCycle } = await import("./db");
      const driver = await getOrCreateDriver(ctx.user.id, "");
      const vehicle = await getOrCreateVehicle(ctx.user.id, "");
      if (!driver.id || !vehicle.id) return { count: 0 };

      // JST基準でサイクル日付を計算（getCurrentCycleと同じロジックを共有）
      const { cycleStartDate, cycleEndDate } = getCurrentCycleDates();

      const cycle = await getOrCreateMonthlyCycle(
        ctx.user.id,
        driver.id,
        vehicle.id,
        dateStrToNoonUTC(cycleStartDate),
        dateStrToNoonUTC(cycleEndDate),
      );
      if (!cycle?.id) return { count: 0 };

      const records = await getDailyRecordsByCycle(cycle.id);
      const count = records.filter((r: any) => r.arrivalTime == null).length;
      return { count };
    }),

    getPdfData: protectedProcedure.input((val: any) => val as { cycleId: number }).query(async ({ ctx, input }) => {
      const { getDailyRecordsByCycle, getAllCycles, getOrCreateDriver, getOrCreateVehicle } = await import("./db");
      const driver = await getOrCreateDriver(ctx.user.id, "");
      const vehicle = await getOrCreateVehicle(ctx.user.id, "");
      const cycles = await getAllCycles(ctx.user.id);
      const cycle = cycles.find((c: any) => c.id === input.cycleId);
      if (!cycle) throw new Error("Cycle not found");
      const records = await getDailyRecordsByCycle(input.cycleId);
      return {
        driverName: driver.driverName,
        vehicleNumber: vehicle.vehicleNumber,
        cycleStartDate: toDateStr(cycle.cycleStartDate),
        cycleEndDate: toDateStr(cycle.cycleEndDate),
        records: records.map((r: any) => ({
          recordDate: toDateStr(r.recordDate),
          departureTime: r.departureTime,
          arrivalTime: r.arrivalTime ?? null,
          departureDistance: parseFloat(r.departureDistance),
          arrivalDistance: r.arrivalDistance != null ? parseFloat(r.arrivalDistance) : null,
          jobCount: r.jobCount ?? null,
        })),
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
