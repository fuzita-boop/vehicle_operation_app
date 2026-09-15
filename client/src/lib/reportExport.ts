export type ReportExportRecord = {
  recordDate: string;
  departureTime: string;
  arrivalTime: string | null;
  departureDistance: number;
  arrivalDistance: number | null;
  jobCount: number | null;
};

export type ReportExportInput = {
  driverName: string;
  vehicleNumber: string;
  cycleStartDate: string;
  cycleEndDate: string;
  printedDate: string;
  records: ReportExportRecord[];
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

function formatDate(value: string) {
  return value.replaceAll("-", "/");
}

function distance(record: ReportExportRecord) {
  return record.arrivalDistance === null ? 0 : Math.max(0, record.arrivalDistance - record.departureDistance);
}

export function createMonthlyReportFilename(input: Pick<ReportExportInput, "cycleStartDate" | "cycleEndDate">) {
  const start = input.cycleStartDate.replace(/-(?=\d{2}$)/, "");
  const end = input.cycleEndDate.slice(5).replace("-", "");
  return `運行日報_${start}-${end}.pdf`;
}

/** A4サイズで印刷・PDF化するため、CSSやPWA画面に依存しない単独HTMLを生成する。 */
export function createMonthlyReportHtml(input: ReportExportInput) {
  const totalDistance = input.records.reduce((sum, record) => sum + distance(record), 0);
  const rows = input.records.length === 0
    ? `<tr><td colspan="7" class="empty">記録がありません</td></tr>`
    : input.records.map((record) => {
      const incomplete = record.arrivalTime === null || record.arrivalDistance === null;
      return `<tr>
        <td>${escapeHtml(formatDate(record.recordDate))}</td>
        <td class="center">${escapeHtml(record.departureTime)}</td>
        <td class="center ${incomplete ? "incomplete" : ""}">${escapeHtml(record.arrivalTime ?? "未入力")}</td>
        <td class="right">${record.departureDistance.toFixed(1)}</td>
        <td class="right ${incomplete ? "incomplete" : ""}">${record.arrivalDistance?.toFixed(1) ?? "-"}</td>
        <td class="right strong ${incomplete ? "incomplete" : ""}">${incomplete ? "-" : distance(record).toFixed(1)}</td>
        <td class="center">${record.jobCount == null ? "" : `${record.jobCount}件`}</td>
      </tr>`;
    }).join("");

  return `<section class="monthly-report-export">
    <header>
      <h1>車両運行日報</h1>
      <div class="identity"><div><span>運転者名</span><strong>${escapeHtml(input.driverName || "-")}</strong></div><div><span>車両番号</span><strong>${escapeHtml(input.vehicleNumber || "-")}</strong></div></div>
      <p class="period">対象期間：${escapeHtml(formatDate(input.cycleStartDate))} 〜 ${escapeHtml(formatDate(input.cycleEndDate))}</p>
    </header>
    <table><thead><tr><th>日付</th><th>出発時間</th><th>終了時間</th><th>出発距離</th><th>終了距離</th><th>走行距離</th><th>稼働件数</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="summary"><p>記録日数：<strong>${input.records.length}日</strong></p><p>総走行距離：<strong>${totalDistance.toFixed(1)} km</strong></p></div>
    <section class="gasoline"><small>※給与計算担当者記載</small><p>ガソリン代：<span class="line">　</span>円（単価）× 総距離数 <strong>${totalDistance.toFixed(1)} km</strong> ＝ <span class="line total">　</span>円</p></section>
    <p class="printed">印刷日：${escapeHtml(formatDate(input.printedDate))}</p>
  </section>`;
}

const exportCss = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", sans-serif; }
  .monthly-report-export { width: 190mm; min-height: 277mm; margin: 0 auto; padding: 3mm; background: #fff; font-size: 9px; line-height: 1.25; }
  header { border-bottom: 2px solid #333; padding-bottom: 2.5mm; margin-bottom: 3mm; }
  h1 { margin: 0 0 2mm; text-align: center; font-size: 16px; line-height: 1.2; }
  .identity { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
  .identity span { display: block; color: #666; font-size: 9px; }
  .identity strong { display: block; margin-top: 1mm; font-size: 11px; }
  .period { margin: 2mm 0 0; color: #555; text-align: center; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { height: 5.5mm; border: 1px solid #333; padding: 0 0.6mm; overflow: hidden; font-size: 8.5px; line-height: 1; vertical-align: middle; white-space: nowrap; }
  th { height: 6.5mm; background: #e5e5e5; font-weight: 700; text-align: center; }
  td:nth-child(1) { width: 16%; } td:nth-child(2), td:nth-child(3) { width: 12%; } td:nth-child(4), td:nth-child(5), td:nth-child(6) { width: 15%; } td:nth-child(7) { width: 15%; }
  .center { text-align: center; } .right { text-align: right; } .strong { font-weight: 700; } .incomplete { color: #b45309; } .empty { padding: 8mm; color: #777; text-align: center; }
  .summary { display: flex; justify-content: space-between; margin-top: 3mm; border-top: 2px solid #333; padding-top: 2.5mm; font-size: 11px; }
  .summary p { margin: 0; } .summary strong { font-size: 13px; }
  .gasoline { margin-top: 3mm; border: 1px solid #888; background: #fafafa; padding: 2mm 3mm; }
  .gasoline small { color: #666; } .gasoline p { margin: 1mm 0 0; } .line { display: inline-block; min-width: 12mm; border-bottom: 1px solid #000; } .line.total { min-width: 20mm; }
  .printed { margin: 2mm 0 0; border-top: 1px solid #ccc; padding-top: 1mm; color: #666; text-align: right; font-size: 8px; }
  @page { size: A4 portrait; margin: 5mm; }
  @media print { .monthly-report-export { margin: 0; } }
`;

function createExportDocument(input: ReportExportInput) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>車両運行日報</title><style>${exportCss}
    .print-action { width: 190mm; margin: 8px auto; text-align: right; }
    .print-action button { border: 0; border-radius: 6px; background: #1d4ed8; color: #fff; padding: 9px 16px; font: 600 14px -apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif; }
    @media print { .print-action { display: none; } }
  </style></head><body><div class="print-action"><button type="button" id="print-now">印刷する</button></div>${createMonthlyReportHtml(input)}<script>document.getElementById("print-now").addEventListener("click", function () { window.print(); });</script></body></html>`;
}

export function openMonthlyReportPrint(input: ReportExportInput) {
  const popup = window.open("", "_blank");
  if (!popup) return false;

  popup.document.open();
  popup.document.write(createExportDocument(input));
  popup.document.close();

  let printed = false;
  const triggerPrint = () => {
    if (printed) return;
    printed = true;
    popup.focus();
    popup.print();
  };
  // iOS Safariでは文書の描画前にprintを呼ぶと白紙になることがあるため、
  // 二回の描画フレームと余裕時間を待ってから自動印刷する。
  popup.addEventListener("load", () => {
    popup.requestAnimationFrame(() => popup.requestAnimationFrame(() => window.setTimeout(triggerPrint, 850)));
  }, { once: true });
  return true;
}

async function createStagingReportFrame(input: ReportExportInput) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  Object.assign(frame.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: "210mm",
    height: "297mm",
    border: "0",
    background: "#fff",
    pointerEvents: "none",
  });

  frame.srcdoc = createExportDocument(input);
  const loaded = new Promise<void>((resolve) => frame.addEventListener("load", () => resolve(), { once: true }));
  document.body.append(frame);
  await loaded;
  await frame.contentDocument?.fonts?.ready;

  const report = frame.contentDocument?.querySelector<HTMLElement>(".monthly-report-export");
  if (!report) {
    frame.remove();
    throw new Error("PDF出力用の月次レポートを準備できませんでした。");
  }
  return { frame, report };
}

function getRenderedContentHeight(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) return canvas.height;

  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  const sampleStep = 4;
  let lastInkY = 0;

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const offset = (y * width + x) * 4;
      if (data[offset] < 245 || data[offset + 1] < 245 || data[offset + 2] < 245) {
        lastInkY = y;
        break;
      }
    }
  }

  return Math.min(height, Math.max(1, lastInkY + sampleStep * 3));
}

/** ブラウザ内でPDFを作成する。サーバー・外部APIは利用しない。 */
export async function saveMonthlyReportPdf(input: ReportExportInput) {
  const { frame, report } = await createStagingReportFrame(input);
  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);

    const canvas = await html2canvas(report, {
      scale: 2,
      backgroundColor: "#ffffff",
      logging: false,
      useCORS: true,
      // 本体のTailwind CSS（OKLCH）と切り離したiframe文書を描画する。
      // html2canvasの既定描画を使うことで、Safariでも白紙にならないようにする。
      foreignObjectRendering: false,
    });
    if (canvas.width < 10 || canvas.height < 10) throw new Error("PDF用の描画内容を取得できませんでした。");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    const margin = 5;
    const usableWidth = 210 - margin * 2;
    const usableHeight = 297 - margin * 2;
    const pixelsPerMm = canvas.width / usableWidth;
    const pagePixels = Math.max(1, Math.floor(usableHeight * pixelsPerMm));
    const renderedHeight = getRenderedContentHeight(canvas);

    for (let top = 0, page = 0; top < renderedHeight; top += pagePixels, page += 1) {
      const height = Math.min(pagePixels, renderedHeight - top);
      const piece = document.createElement("canvas");
      piece.width = canvas.width;
      piece.height = height;
      piece.getContext("2d")?.drawImage(canvas, 0, top, canvas.width, height, 0, 0, canvas.width, height);
      if (page > 0) pdf.addPage();
      pdf.addImage(piece, "PNG", margin, margin, usableWidth, height / pixelsPerMm, undefined, "FAST");
    }

    const blob = pdf.output("blob");
    const filename = createMonthlyReportFilename(input);
    const file = new File([blob], filename, { type: "application/pdf" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "車両運行日報" });
        return "share" as const;
      } catch (shareError) {
        // PDF生成は非同期なので、iOSでは共有シート呼び出しの時点でユーザー操作の権限が失効することがある。
        // この場合でもPDF自体は作成済みのため、以下のダウンロード処理へ確実に引き継ぐ。
        console.info("共有シートを開けなかったため、PDFダウンロードへ切り替えます。", shareError);
      }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return "download" as const;
  } finally {
    frame.remove();
  }
}
