import PDFDocument from "pdfkit";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_PATH = path.join(__dirname, "fonts", "NotoSansCJKjp-Regular.otf");

export interface DailyRecordRow {
  recordDate: string; // YYYY-MM-DD
  departureTime: string;
  arrivalTime: string | null;
  departureDistance: number;
  arrivalDistance: number | null;
}

export interface PdfReportOptions {
  driverName: string;
  vehicleNumber: string;
  cycleStartDate: string; // YYYY-MM-DD
  cycleEndDate: string;   // YYYY-MM-DD
  records: DailyRecordRow[];
}

/** YYYY-MM-DD → YYYY/MM/DD */
function fmtDate(s: string): string {
  return s.replace(/-/g, "/");
}

/** 走行距離を計算（両方あれば差分、なければ "-"）*/
function calcDistance(dep: number, arr: number | null): string {
  if (arr == null) return "-";
  return (arr - dep).toFixed(1);
}

export function generateMonthlyReportPdf(opts: PdfReportOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 30,
      info: { Title: "運行日報", Author: opts.driverName },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // フォント登録
    doc.registerFont("JP", FONT_PATH);
    doc.font("JP");

    const pageWidth = doc.page.width - 60; // 両端30pxマージン

    // ===== タイトル =====
    doc.fontSize(16).text("運 行 日 報", { align: "center" });
    doc.moveDown(0.5);

    // ===== 基本情報 =====
    doc.fontSize(10);
    const infoY = doc.y;
    doc.text(`運転者: ${opts.driverName}`, 30, infoY);
    doc.text(`車両番号: ${opts.vehicleNumber}`, 200, infoY);
    doc.text(
      `対象期間: ${fmtDate(opts.cycleStartDate)} ～ ${fmtDate(opts.cycleEndDate)}`,
      350,
      infoY
    );
    doc.moveDown(1);

    // ===== テーブルヘッダー =====
    const tableTop = doc.y;
    const colWidths = [70, 55, 55, 65, 65, 55]; // 日付/出発時間/終了時間/出発距離/終了距離/走行距離
    const colHeaders = ["日付", "出発時間", "終了時間", "出発距離(km)", "終了距離(km)", "走行距離(km)"];
    const rowHeight = 18;

    // ヘッダー背景
    doc.rect(30, tableTop, pageWidth, rowHeight).fill("#e8e8e8");
    doc.fillColor("black");

    let x = 30;
    doc.fontSize(8);
    colHeaders.forEach((h, i) => {
      doc.text(h, x + 2, tableTop + 4, { width: colWidths[i] - 4, align: "center" });
      x += colWidths[i];
    });

    // ヘッダー枠線
    x = 30;
    doc.rect(30, tableTop, pageWidth, rowHeight).stroke();
    colWidths.forEach((w) => {
      doc.moveTo(x, tableTop).lineTo(x, tableTop + rowHeight).stroke();
      x += w;
    });

    // ===== テーブル行 =====
    let totalDistance = 0;
    let rowY = tableTop + rowHeight;

    opts.records.forEach((rec, idx) => {
      const dist = calcDistance(rec.departureDistance, rec.arrivalDistance);
      if (dist !== "-") totalDistance += parseFloat(dist);

      // 縞模様
      if (idx % 2 === 1) {
        doc.rect(30, rowY, pageWidth, rowHeight).fill("#f9f9f9");
        doc.fillColor("black");
      }

      const cells = [
        fmtDate(rec.recordDate),
        rec.departureTime,
        rec.arrivalTime ?? "-",
        rec.departureDistance.toFixed(1),
        rec.arrivalDistance != null ? rec.arrivalDistance.toFixed(1) : "-",
        dist,
      ];

      x = 30;
      doc.fontSize(8);
      cells.forEach((cell, i) => {
        doc.text(cell, x + 2, rowY + 4, { width: colWidths[i] - 4, align: "center" });
        x += colWidths[i];
      });

      // 行枠線
      doc.rect(30, rowY, pageWidth, rowHeight).stroke();
      x = 30;
      colWidths.forEach((w) => {
        doc.moveTo(x, rowY).lineTo(x, rowY + rowHeight).stroke();
        x += w;
      });

      rowY += rowHeight;
    });

    // ===== 合計行 =====
    doc.rect(30, rowY, pageWidth, rowHeight).fill("#e8e8e8");
    doc.fillColor("black");
    doc.fontSize(9).text(
      `記録日数: ${opts.records.length}日　　総走行距離: ${totalDistance.toFixed(1)} km`,
      30,
      rowY + 4,
      { width: pageWidth, align: "right" }
    );
    doc.rect(30, rowY, pageWidth, rowHeight).stroke();

    rowY += rowHeight + 20;

    // ===== ガソリン代計算欄 =====
    doc.fontSize(8).fillColor("#555555").text("※ 給与計算担当者記載欄", 30, rowY);
    rowY += 14;

    const gasColW = [120, 80, 80, 80];
    const gasHeaders = ["項目", "走行距離(km)", "単価(円/km)", "合計金額(円)"];
    const gasData = [totalDistance.toFixed(1), "", ""];

    // ヘッダー
    doc.rect(30, rowY, 360, rowHeight).fill("#e8e8e8");
    doc.fillColor("black");
    x = 30;
    gasHeaders.forEach((h, i) => {
      doc.fontSize(8).text(h, x + 2, rowY + 4, { width: gasColW[i] - 4, align: "center" });
      x += gasColW[i];
    });
    doc.rect(30, rowY, 360, rowHeight).stroke();
    x = 30;
    gasColW.forEach((w) => {
      doc.moveTo(x, rowY).lineTo(x, rowY + rowHeight).stroke();
      x += w;
    });
    rowY += rowHeight;

    // データ行
    const gasRow = ["ガソリン代", ...gasData];
    x = 30;
    gasRow.forEach((cell, i) => {
      doc.fontSize(8).text(cell, x + 2, rowY + 4, { width: gasColW[i] - 4, align: "center" });
      x += gasColW[i];
    });
    doc.rect(30, rowY, 360, rowHeight).stroke();
    x = 30;
    gasColW.forEach((w) => {
      doc.moveTo(x, rowY).lineTo(x, rowY + rowHeight).stroke();
      x += w;
    });

    doc.end();
  });
}
