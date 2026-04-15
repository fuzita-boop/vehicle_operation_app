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
      
      // JST基準で日付を計算（UTC+9）
      const nowJST = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const year = nowJST.getUTCFullYear();
      const month = nowJST.getUTCMonth(); // 0-indexed
      const day = nowJST.getUTCDate();
      
      let cycleStartStr: string, cycleEndStr: string;
      if (day >= 16) {
        // 当月16日〜翌月15日
        cycleStartStr = `${year}-${String(month + 1).padStart(2, '0')}-16`;
        const endYear = month === 11 ? year + 1 : year;
        const endMonth = month === 11 ? 1 : month + 2;
        cycleEndStr = `${endYear}-${String(endMonth).padStart(2, '0')}-15`;
      } else {
        // 前月16日〜当月15日
        const startYear = month === 0 ? year - 1 : year;
        const startMonth = month === 0 ? 12 : month;
        cycleStartStr = `${startYear}-${String(startMonth).padStart(2, '0')}-16`;
        cycleEndStr = `${year}-${String(month + 1).padStart(2, '0')}-15`;
      }
      
      // YYYY-MM-DD文字列をnoon UTCのDateに変換（DBの日付型と一致させる）
      const [sy, sm, sd] = cycleStartStr.split('-').map(Number);
      const [ey, em, ed] = cycleEndStr.split('-').map(Number);
      const cycleStart = new Date(Date.UTC(sy, sm - 1, sd, 12, 0, 0));
      const cycleEnd = new Date(Date.UTC(ey, em - 1, ed, 12, 0, 0));
      
      const cycle = await getOrCreateMonthlyCycle(ctx.user.id, driver.id, vehicle.id, cycleStart, cycleEnd);
      // Return dates as YYYY-MM-DD strings
      return {
        ...cycle,
        cycleStartDate: cycleStartStr,
        cycleEndDate: cycleEndStr,
      };
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
      const cycles = await getAllCycles(ctx.user.id);
      // Return dates as YYYY-MM-DD strings to avoid timezone shift on client
      return cycles.map((c: any) => ({
        ...c,
        cycleStartDate: c.cycleStartDate instanceof Date
          ? `${c.cycleStartDate.getUTCFullYear()}-${String(c.cycleStartDate.getUTCMonth()+1).padStart(2,'0')}-${String(c.cycleStartDate.getUTCDate()).padStart(2,'0')}`
          : String(c.cycleStartDate).split('T')[0],
        cycleEndDate: c.cycleEndDate instanceof Date
          ? `${c.cycleEndDate.getUTCFullYear()}-${String(c.cycleEndDate.getUTCMonth()+1).padStart(2,'0')}-${String(c.cycleEndDate.getUTCDate()).padStart(2,'0')}`
          : String(c.cycleEndDate).split('T')[0],
      }));
    }),
    getIncompleteCount: protectedProcedure.query(async ({ ctx }) => {
      const { getOrCreateDriver, getOrCreateVehicle, getOrCreateMonthlyCycle, getDailyRecordsByCycle } = await import("./db");
      const driver = await getOrCreateDriver(ctx.user.id, "");
      const vehicle = await getOrCreateVehicle(ctx.user.id, "");
      if (!driver.id || !vehicle.id) return { count: 0 };
      // JST基準で日付を計算（UTC+9）
      const nowJST = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const year = nowJST.getUTCFullYear();
      const month = nowJST.getUTCMonth();
      const day = nowJST.getUTCDate();
      let cycleStartStr: string, cycleEndStr: string;
      if (day >= 16) {
        cycleStartStr = `${year}-${String(month + 1).padStart(2, '0')}-16`;
        const endYear = month === 11 ? year + 1 : year;
        const endMonth = month === 11 ? 1 : month + 2;
        cycleEndStr = `${endYear}-${String(endMonth).padStart(2, '0')}-15`;
      } else {
        const startYear = month === 0 ? year - 1 : year;
        const startMonth = month === 0 ? 12 : month;
        cycleStartStr = `${startYear}-${String(startMonth).padStart(2, '0')}-16`;
        cycleEndStr = `${year}-${String(month + 1).padStart(2, '0')}-15`;
      }
      const [sy, sm, sd] = cycleStartStr.split('-').map(Number);
      const [ey, em, ed] = cycleEndStr.split('-').map(Number);
      const cycleStart = new Date(Date.UTC(sy, sm - 1, sd, 12, 0, 0));
      const cycleEnd = new Date(Date.UTC(ey, em - 1, ed, 12, 0, 0));
      const cycle = await getOrCreateMonthlyCycle(ctx.user.id, driver.id, vehicle.id, cycleStart, cycleEnd);
      if (!cycle?.id) return { count: 0 };
      const records = await getDailyRecordsByCycle(cycle.id);
      const count = records.filter((r: any) => r.arrivalTime == null).length;
      return { count };
    }),
  }),
});

export type AppRouter = typeof appRouter;
