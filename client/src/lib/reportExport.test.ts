import { describe, expect, it } from "vitest";
import { createMonthlyReportFilename, createMonthlyReportHtml } from "./reportExport";

const input = {
  driverName: "藤田 太郎",
  vehicleNumber: "品川 500 あ 1234",
  cycleStartDate: "2026-08-16",
  cycleEndDate: "2026-09-15",
  printedDate: "2026-08-18",
  records: [{
    recordDate: "2026-08-18",
    departureTime: "09:00",
    arrivalTime: "17:30",
    departureDistance: 12345.6,
    arrivalDistance: 12378.1,
    jobCount: 4,
  }],
};

describe("月次レポート出力", () => {
  it("A4出力用HTMLに記録・集計・ガソリン代欄を含める", () => {
    const html = createMonthlyReportHtml(input);
    expect(html).toContain("車両運行日報");
    expect(html).toContain("藤田 太郎");
    expect(html).toContain("32.5 km");
    expect(html).toContain("ガソリン代");
    expect(html).toContain("稼働件数");
  });

  it("サイクル期間を含むPDFファイル名を生成する", () => {
    expect(createMonthlyReportFilename(input)).toBe("運行日報_2026-08-16_2026-09-15.pdf");
  });
});
