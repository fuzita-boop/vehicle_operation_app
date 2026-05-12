import PDFDocument from "pdfkit";

const FONT_CDN_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663217122276/megdFLwq3PKkC44ndRH8R7/NotoSansCJKjp-Regular_69dda62e.otf";

// フォントバッファをキャッシュ（起動後初回のみDL）
let _fontBuffer: Buffer | null = null;
async function getFontBuffer(): Promise<Buffer> {
  if (_fontBuffer) return _fontBuffer;
  const res = await fetch(FONT_CDN_URL);
  if (!res.ok) throw new Error(`Failed to fetch font: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  _fontBuffer = Buffer.from(arrayBuffer);
  return _fontBuffer;
}

export interface DailyRecordRow {
  recordDate: string; // YYYY-MM-DD
  departureTime: string;
  arrivalTime: string | null;
  departureDistance: number;
  arrivalDistance: number | null;
  notes?: string | null;
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

/** 今日の日付を YYYY/MM/DD で返す（JST） */
function todayJST(): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

/** 走行距離を計算 */
function calcDist(dep: number, arr: number | null): number | null {
  if (arr == null) return null;
  return arr - dep;
}

// ---- 描画ヘルパー ----

/** 水平線を引く */
function hLine(doc: InstanceType<typeof PDFDocument>, x: number, y: number, w: number, color = "#000000", lw = 0.5) {
  doc.save().strokeColor(color).lineWidth(lw).moveTo(x, y).lineTo(x + w, y).stroke().restore();
}

/** 矩形を塗りつぶす */
function fillRect(doc: InstanceType<typeof PDFDocument>, x: number, y: number, w: number, h: number, color: string) {
  doc.save().rect(x, y, w, h).fill(color).restore();
}

/** 矩形の枠線を引く */
function strokeRect(doc: InstanceType<typeof PDFDocument>, x: number, y: number, w: number, h: number, color = "#555555", lw = 0.5) {
  doc.save().rect(x, y, w, h).strokeColor(color).lineWidth(lw).stroke().restore();
}

/** テキストをセル内に描画（縦中央揃え） */
function cellText(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { align?: "left" | "center" | "right"; fontSize?: number; bold?: boolean; color?: string } = {}
) {
  const fs = opts.fontSize ?? 8;
  const color = opts.color ?? "#000000";
  // テキストの高さを概算して縦中央に
  const textH = fs * 1.2;
  const textY = y + (h - textH) / 2;
  doc.save().fillColor(color).fontSize(fs).text(text, x + 2, textY, {
    width: w - 4,
    align: opts.align ?? "left",
    lineBreak: false,
  }).restore();
}

export async function generateMonthlyReportPdf(opts: PdfReportOptions): Promise<Buffer> {
  const fontBuffer = await getFontBuffer();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 22, bottom: 22, left: 28, right: 28 },
      info: { Title: "車両運行日報", Author: opts.driverName },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont("JP", fontBuffer);
    doc.font("JP");

    const L = 28;  // 左マージン
    const R = 28;  // 右マージン
    const PW = doc.page.width - L - R; // 利用可能幅 ≒ 539pt

    let y = 22; // 現在のY座標

    // ===== タイトル =====
    doc.save()
      .fillColor("#000000")
      .fontSize(14)
      .font("JP")
      .text("車 両 運 行 日 報", L, y, { width: PW, align: "center" })
      .restore();
    y += 20;
    hLine(doc, L, y, PW, "#000000", 1.5);
    y += 5;

    // ===== 運転者・車両番号（2列グリッド） =====
    const infoColW = PW / 2 - 6;
    // 左列：運転者名
    doc.save().fillColor("#555555").fontSize(7).text("運転者名", L, y).restore();
    y += 9;
    doc.save().fillColor("#000000").fontSize(10).font("JP").text(opts.driverName || "　", L, y).restore();
    hLine(doc, L, y + 13, infoColW, "#cccccc", 0.5);
    // 右列：車両番号
    const col2X = L + PW / 2 + 6;
    doc.save().fillColor("#555555").fontSize(7).text("車両番号", col2X, y - 9).restore();
    doc.save().fillColor("#000000").fontSize(10).font("JP").text(opts.vehicleNumber || "　", col2X, y).restore();
    hLine(doc, col2X, y + 13, infoColW, "#cccccc", 0.5);
    y += 18;

    // ===== 対象期間（グレー帯） =====
    const periodH = 14;
    fillRect(doc, L, y, PW, periodH, "#f5f5f5");
    strokeRect(doc, L, y, PW, periodH, "#cccccc", 0.5);
    const periodText = `対象期間：${fmtDate(opts.cycleStartDate)} 〜 ${fmtDate(opts.cycleEndDate)}`;
    doc.save().fillColor("#444444").fontSize(8).text(periodText, L, y + 3, { width: PW, align: "center" }).restore();
    y += periodH + 6;

    // ===== テーブル =====
    // 列定義（印刷HTMLと同じ比率: 13/11/11/15/15/13/22 → 備考列追加）
    const totalParts = 13 + 11 + 11 + 15 + 15 + 13 + 22;
    const colWidths = [13, 11, 11, 15, 15, 13, 22].map(p => Math.floor(PW * p / totalParts));
    // 端数を最後の列に加算
    const sumW = colWidths.reduce((a, b) => a + b, 0);
    colWidths[6] += PW - sumW;

    const colHeaders = ["日付", "出発時間", "終了時間", "出発時距離(km)", "終了時距離(km)", "走行距離(km)", "備考"];
    const rowH = 16;

    // ヘッダー行
    fillRect(doc, L, y, PW, rowH, "#d0d0d0");
    let cx = L;
    colHeaders.forEach((h, i) => {
      cellText(doc, h, cx, y, colWidths[i], rowH, { align: "center", fontSize: 7 });
      cx += colWidths[i];
    });
    strokeRect(doc, L, y, PW, rowH, "#333333", 0.5);
    // 縦線
    cx = L;
    colWidths.forEach((w) => {
      doc.save().strokeColor("#333333").lineWidth(0.5).moveTo(cx, y).lineTo(cx, y + rowH).stroke().restore();
      cx += w;
    });
    y += rowH;

    // データ行
    let totalDistance = 0;
    opts.records.forEach((rec, idx) => {
      const dist = calcDist(rec.departureDistance, rec.arrivalDistance);
      if (dist != null) totalDistance += dist;

      const isIncomplete = rec.arrivalDistance == null;

      // 縞模様
      if (idx % 2 === 1) {
        fillRect(doc, L, y, PW, rowH, "#fafafa");
      }

      const cells = [
        fmtDate(rec.recordDate),
        rec.departureTime,
        isIncomplete ? "未入力" : (rec.arrivalTime ?? "未入力"),
        rec.departureDistance.toFixed(1),
        isIncomplete ? "-" : rec.arrivalDistance!.toFixed(1),
        dist != null ? dist.toFixed(1) : "-",
        rec.notes ?? "",
      ];
      const aligns: ("left" | "center" | "right")[] = ["left", "center", "center", "right", "right", "right", "left"];
      const colors = cells.map((_, i) => (isIncomplete && i >= 2 && i <= 5) ? "#b45309" : "#000000");

      cx = L;
      cells.forEach((cell, i) => {
        cellText(doc, cell, cx, y, colWidths[i], rowH, {
          align: aligns[i],
          fontSize: 8,
          color: colors[i],
        });
        cx += colWidths[i];
      });

      strokeRect(doc, L, y, PW, rowH, "#555555", 0.5);
      cx = L;
      colWidths.forEach((w) => {
        doc.save().strokeColor("#555555").lineWidth(0.5).moveTo(cx, y).lineTo(cx, y + rowH).stroke().restore();
        cx += w;
      });

      y += rowH;
    });

    // 空データ行
    if (opts.records.length === 0) {
      cellText(doc, "記録がありません", L, y, PW, rowH, { align: "center", fontSize: 8, color: "#888888" });
      strokeRect(doc, L, y, PW, rowH, "#555555", 0.5);
      y += rowH;
    }

    // ===== 合計行 =====
    hLine(doc, L, y, PW, "#000000", 1.5);
    y += 4;
    doc.save()
      .fillColor("#444444").fontSize(8)
      .text("記録日数：", L, y)
      .restore();
    doc.save()
      .fillColor("#000000").fontSize(11).font("JP")
      .text(`${opts.records.length} 日`, L + 42, y - 1)
      .restore();
    doc.save()
      .fillColor("#444444").fontSize(8)
      .text("総走行距離：", L + PW - 130, y)
      .restore();
    doc.save()
      .fillColor("#000000").fontSize(11).font("JP")
      .text(`${totalDistance.toFixed(1)} km`, L + PW - 65, y - 1)
      .restore();
    y += 18;

    // ===== ガソリン代計算欄 =====
    const gasBoxH = 38;
    strokeRect(doc, L, y, PW, gasBoxH, "#888888", 1);
    fillRect(doc, L, y, PW, gasBoxH, "#fafafa");
    strokeRect(doc, L, y, PW, gasBoxH, "#888888", 1);

    doc.save().fillColor("#555555").fontSize(7).text("※給与計算担当者記載", L + 4, y + 4).restore();

    // ガソリン代計算式（横並び）
    const gy = y + 16;
    let gx = L + 4;
    doc.save().fillColor("#000000").fontSize(9).text("ガソリン代：", gx, gy).restore();
    gx += 58;
    // 単価入力欄（下線）
    hLine(doc, gx, gy + 11, 50, "#000000", 0.8);
    gx += 54;
    doc.save().fillColor("#000000").fontSize(9).text("円（単価）×総距離数", gx, gy).restore();
    gx += 96;
    doc.save().fillColor("#000000").fontSize(9).font("JP").text(`${totalDistance.toFixed(1)}`, gx, gy).restore();
    gx += 36;
    doc.save().fillColor("#000000").fontSize(9).text("km ＝", gx, gy).restore();
    gx += 30;
    // 合計入力欄（下線）
    hLine(doc, gx, gy + 11, 70, "#000000", 0.8);
    gx += 74;
    doc.save().fillColor("#000000").fontSize(9).text("円", gx, gy).restore();
    y += gasBoxH + 6;

    // ===== フッター =====
    hLine(doc, L, y, PW, "#cccccc", 0.5);
    y += 3;
    doc.save().fillColor("#888888").fontSize(6)
      .text(`印刷日：${todayJST()}`, L, y)
      .restore();
    doc.save().fillColor("#888888").fontSize(6)
      .text("※ 帰着未入力の欄はオレンジ色で表示しています", L, y, { width: PW, align: "right" })
      .restore();

    doc.end();
  });
}
