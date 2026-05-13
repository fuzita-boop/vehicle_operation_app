import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";
import { monthlyCycles, dailyRecords, drivers, vehicles } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { generateMonthlyReportPdf } from "./pdfGenerator";

/** セッションCookieからユーザーIDを取得（認証チェック） */
async function getUserIdFromRequest(req: Request): Promise<number | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/** YYYY-MM-DD 文字列に正規化（Date型・文字列どちらでも対応） */
function toDateStr(val: unknown): string {
  if (val instanceof Date) {
    return `${val.getUTCFullYear()}-${String(val.getUTCMonth() + 1).padStart(2, "0")}-${String(val.getUTCDate()).padStart(2, "0")}`;
  }
  return String(val).split("T")[0];
}

export function registerPdfRoutes(app: Express) {
  /**
   * GET /api/pdf/monthly-report?cycleId=123
   * 認証済みユーザーの月次レポートをPDFとしてダウンロード
   */
  app.get("/api/pdf/monthly-report", async (req: Request, res: Response) => {
    try {
      const userId = await getUserIdFromRequest(req);
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const cycleId = parseInt(req.query.cycleId as string);
      if (isNaN(cycleId)) {
        res.status(400).json({ error: "cycleId is required" });
        return;
      }

      const db = await getDb();
      if (!db) {
        res.status(500).json({ error: "Database not available" });
        return;
      }

      // サイクル取得（所有者チェック）
      const cycles = await db
        .select()
        .from(monthlyCycles)
        .where(and(eq(monthlyCycles.id, cycleId), eq(monthlyCycles.userId, userId)))
        .limit(1);

      if (cycles.length === 0) {
        res.status(404).json({ error: "Cycle not found" });
        return;
      }

      const cycle = cycles[0];

      // 運転者・車両情報取得
      const driverRows = await db
        .select()
        .from(drivers)
        .where(eq(drivers.userId, userId))
        .limit(1);
      const vehicleRows = await db
        .select()
        .from(vehicles)
        .where(eq(vehicles.userId, userId))
        .limit(1);

      const driverName = driverRows[0]?.driverName ?? "";
      const vehicleNumber = vehicleRows[0]?.vehicleNumber ?? "";

      // 日次記録取得（日付昇順）
      const records = await db
        .select()
        .from(dailyRecords)
        .where(eq(dailyRecords.cycleId, cycleId))
        .orderBy(dailyRecords.recordDate);

      const cycleStartDate = toDateStr(cycle.cycleStartDate);
      const cycleEndDate = toDateStr(cycle.cycleEndDate);

      const pdfBuffer = await generateMonthlyReportPdf({
        driverName,
        vehicleNumber,
        cycleStartDate,
        cycleEndDate,
        records: records.map((r) => ({
          recordDate: toDateStr(r.recordDate),
          departureTime: r.departureTime,
          arrivalTime: r.arrivalTime ?? null,
          departureDistance: parseFloat(r.departureDistance as unknown as string),
          arrivalDistance: r.arrivalDistance != null ? parseFloat(r.arrivalDistance as unknown as string) : null,
          jobCount: r.jobCount ?? null,
        })),
      });

      const filename = `運行日報_${cycleStartDate}_${cycleEndDate}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (err) {
      console.error("[PDF] Error generating PDF:", err);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });
}
