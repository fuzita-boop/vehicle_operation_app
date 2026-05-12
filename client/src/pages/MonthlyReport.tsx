import { useEffect, useState, useCallback, useMemo } from "react";
import VehicleLayout from "@/components/VehicleLayout";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ArrowLeft, Printer, ChevronLeft, ChevronRight, Download } from "lucide-react";

interface ReportRecord {
  id?: number;
  recordDate: string | Date;
  departureTime: string;
  arrivalTime: string | null;
  departureDistance: number | string;
  arrivalDistance: number | string | null;
  notes?: string | null;
  cycleId?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface CycleOption {
  id: number;
  cycleStartDate: string;
  cycleEndDate: string;
  label: string;
}

/** YYYY-MM-DD 文字列を "YYYY/MM/DD" 形式の日本語表記に変換（UTC基準）*/
function formatDateJP(val: string | Date | unknown): string {
  if (!val) return "";
  let str: string;
  if (val instanceof Date) {
    // Date オブジェクトの場合はUTC基準でYYYY-MM-DDを取得
    str = val.toISOString().split("T")[0];
  } else {
    str = String(val);
    // ISO文字列の場合はT以前のみ取得
    if (str.includes("T")) str = str.split("T")[0];
  }
  // YYYY-MM-DD → YYYY/MM/DD
  const parts = str.split("-");
  if (parts.length === 3) {
    return `${parts[0]}/${parts[1]}/${parts[2]}`;
  }
  return str;
}

/** recordDate を YYYY-MM-DD 文字列に正規化（UTC基準）*/
function toDateStr(val: string | Date | unknown): string {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString().split("T")[0];
  const str = String(val);
  if (str.includes("T")) return str.split("T")[0];
  return str;
}

export default function MonthlyReport() {
  const [records, setRecords] = useState<ReportRecord[]>([]);
  const [driverName, setDriverName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);

  // 並列クエリ：currentCycle と allCycles を同時に取得
  const { data: currentCycle } = trpc.vehicle.getCurrentCycle.useQuery();
  const { data: allCycles } = trpc.vehicle.getCycles.useQuery();
  const { data: driver } = trpc.vehicle.getDriver.useQuery();
  const { data: vehicle } = trpc.vehicle.getVehicle.useQuery();

  // 表示対象のサイクルID（選択中 or 現在のサイクル）
  // allCycles が取得できたら最新サイクルを初期選択
  const activeCycleId = useMemo(() => {
    if (selectedCycleId !== null) return selectedCycleId;
    if (currentCycle?.id) return currentCycle.id;
    return null;
  }, [selectedCycleId, currentCycle?.id]);

  const { data: fetchedRecords } = trpc.vehicle.getRecords.useQuery(
    activeCycleId ? { cycleId: activeCycleId } : { cycleId: 0 },
    { enabled: !!activeCycleId }
  );

  // サイクル選択肢（新しい順）
  const cycleOptions = useMemo<CycleOption[]>(() => {
    if (!allCycles) return [];
    return [...allCycles]
      .sort((a, b) => {
        const aStr = typeof a.cycleStartDate === "string" ? a.cycleStartDate : toDateStr(a.cycleStartDate);
        const bStr = typeof b.cycleStartDate === "string" ? b.cycleStartDate : toDateStr(b.cycleStartDate);
        return bStr.localeCompare(aStr);
      })
      .map((c) => {
        const startStr = typeof c.cycleStartDate === "string" ? c.cycleStartDate.split("T")[0] : toDateStr(c.cycleStartDate);
        const endStr = typeof c.cycleEndDate === "string" ? c.cycleEndDate.split("T")[0] : toDateStr(c.cycleEndDate);
        const start = formatDateJP(startStr);
        const end = formatDateJP(endStr);
        const isCurrentCycle = c.id === currentCycle?.id;
        return {
          id: c.id,
          cycleStartDate: startStr,
          cycleEndDate: endStr,
          label: isCurrentCycle ? `${start} 〜 ${end}（今月）` : `${start} 〜 ${end}`,
        };
      });
  }, [allCycles, currentCycle?.id]);

  // 現在選択中のサイクル情報
  const activeCycleOption = useMemo(() => {
    if (!activeCycleId) return null;
    return cycleOptions.find((c) => c.id === activeCycleId) ?? null;
  }, [cycleOptions, activeCycleId]);

  const cycleInfo = useMemo(() => {
    if (!activeCycleOption) {
      // allCycles 未取得時は currentCycle から直接取得
      if (currentCycle) {
        return {
          start: formatDateJP(currentCycle.cycleStartDate),
          end: formatDateJP(currentCycle.cycleEndDate),
        };
      }
      return { start: "", end: "" };
    }
    return {
      start: formatDateJP(activeCycleOption.cycleStartDate),
      end: formatDateJP(activeCycleOption.cycleEndDate),
    };
  }, [activeCycleOption, currentCycle]);

  // 現在選択中のインデックス（cycleOptions内）
  const currentIndex = useMemo(() => {
    if (!activeCycleId) return 0;
    return cycleOptions.findIndex((c) => c.id === activeCycleId);
  }, [cycleOptions, activeCycleId]);

  useEffect(() => {
    if (driver?.driverName) setDriverName(driver.driverName);
  }, [driver]);

  useEffect(() => {
    if (vehicle?.vehicleNumber) setVehicleNumber(vehicle.vehicleNumber);
  }, [vehicle]);

  useEffect(() => {
    if (fetchedRecords && activeCycleId) {
      setRecords(
        fetchedRecords.map((r) => ({
          ...r,
          recordDate: toDateStr(r.recordDate),
          departureDistance:
            typeof r.departureDistance === "string"
              ? parseFloat(r.departureDistance)
              : r.departureDistance,
          arrivalDistance:
            r.arrivalDistance == null
              ? null
              : typeof r.arrivalDistance === "string"
                ? parseFloat(r.arrivalDistance)
                : r.arrivalDistance,
          arrivalTime: r.arrivalTime ?? null,
        }))
      );
    }
  }, [fetchedRecords, activeCycleId]);

  const calculateDistance = (departure: number, arrival: number | null) => {
    if (arrival == null) return 0;
    return Math.max(0, arrival - departure);
  };

  const totalDistance = records.reduce((sum, record) => {
    const depDist =
      typeof record.departureDistance === "string"
        ? parseFloat(record.departureDistance)
        : (record.departureDistance as number);
    const arrDist =
      record.arrivalDistance == null
        ? null
        : typeof record.arrivalDistance === "string"
          ? parseFloat(record.arrivalDistance)
          : (record.arrivalDistance as number);
    return sum + calculateDistance(depDist, arrDist);
  }, 0);

  // 前後のサイクルに移動
  const goToPrev = () => {
    if (currentIndex < cycleOptions.length - 1) {
      setSelectedCycleId(cycleOptions[currentIndex + 1].id);
    }
  };
  const goToNext = () => {
    if (currentIndex > 0) {
      setSelectedCycleId(cycleOptions[currentIndex - 1].id);
    }
  };

  // PDFダウンロード
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const handleDownloadPdf = useCallback(async () => {
    if (!activeCycleId) return;
    setIsPdfLoading(true);
    try {
      const response = await fetch(`/api/pdf/monthly-report?cycleId=${activeCycleId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("PDF生成に失敗しました");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Content-Dispositionのファイル名を取得
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename\*=UTF-8''(.+)/);
      a.download = match ? decodeURIComponent(match[1]) : `運行日報_${activeCycleId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("PDFのダウンロードに失敗しました。もう一度お試しください。");
      console.error(err);
    } finally {
      setIsPdfLoading(false);
    }
  }, [activeCycleId]);

  // 印刷用スタンドアロンHTML生成
  const handlePrint = useCallback(() => {
    const tableRows = records.map((record) => {
      const depDist =
        typeof record.departureDistance === "string"
          ? parseFloat(record.departureDistance)
          : (record.departureDistance as number);
      const arrDist =
        record.arrivalDistance == null
          ? null
          : typeof record.arrivalDistance === "string"
            ? parseFloat(record.arrivalDistance)
            : (record.arrivalDistance as number);
      const distance = calculateDistance(depDist, arrDist);
      const dateStr = formatDateJP(record.recordDate);

      const incompleteClass = arrDist == null ? ' class="incomplete"' : '';
      const notesVal = (record as any).notes ?? '';
      return `<tr>
        <td>${dateStr}</td>
        <td style="text-align:center">${record.departureTime}</td>
        <td style="text-align:center"${incompleteClass}>${arrDist != null ? record.arrivalTime ?? "未入力" : "未入力"}</td>
        <td style="text-align:right">${depDist.toFixed(1)}</td>
        <td style="text-align:right"${incompleteClass}>${arrDist != null ? arrDist.toFixed(1) : "-"}</td>
        <td style="text-align:right;font-weight:600"${incompleteClass}>${arrDist != null ? distance.toFixed(1) : "-"}</td>
        <td style="font-size:7pt;color:#444;white-space:normal;word-break:break-all">${notesVal}</td>
      </tr>`;
    }).join("");

    const emptyRow =
      records.length === 0
        ? `<tr><td colspan="6" style="text-align:center;padding:20px;color:#888">記録がありません</td></tr>`
        : "";

    // 印刷日もUTC基準のYYYY/MM/DDで表示
    const today = new Date();
    const printDate = `${today.getFullYear()}/${String(today.getMonth()+1).padStart(2,'0')}/${String(today.getDate()).padStart(2,'0')}`;

    const printHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>車両運行日報</title>
<style>
  @page {
    size: A4 portrait;
    margin: 8mm 10mm 8mm 10mm;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 100%;
    font-family: "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", "Yu Gothic", "Meiryo", sans-serif;
    font-size: 9pt;
    line-height: 1.3;
    color: #000;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .title {
    text-align: center;
    font-size: 13pt;
    font-weight: 700;
    padding-bottom: 3pt;
    border-bottom: 2pt solid #000;
    margin-bottom: 4pt;
    letter-spacing: 0.1em;
  }
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2pt 12pt;
    margin-bottom: 2pt;
    font-size: 8pt;
  }
  .info-label { color: #555; font-size: 7pt; margin-bottom: 0; }
  .info-value { font-weight: 700; font-size: 9pt; border-bottom: 1pt solid #ccc; padding-bottom: 1pt; }
  .period {
    text-align: center;
    font-size: 8pt;
    color: #444;
    margin: 3pt 0 5pt;
    padding: 2pt;
    background: #f5f5f5;
    border-radius: 2pt;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10pt;
    table-layout: fixed;
    page-break-inside: auto;
  }
  thead { display: table-header-group; }
  tbody tr { page-break-inside: avoid; }
  th {
    background-color: #d0d0d0;
    font-weight: 700;
    text-align: center;
    font-size: 7pt;
    border: 0.5pt solid #333;
    padding: 2pt 2pt;
  }
  td {
    border: 0.5pt solid #555;
    padding: 2pt 3pt;
    overflow: hidden;
    white-space: nowrap;
    font-size: 8pt;
  }
  tr:nth-child(even) td { background-color: #fafafa; }
  .incomplete { color: #b45309; font-style: italic; }
  .summary {
    border-top: 1.5pt solid #000;
    margin-top: 4pt;
    padding-top: 3pt;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 9pt;
  }
  .summary .total-label { color: #444; font-size: 8pt; }
  .summary .total-value { font-size: 11pt; font-weight: 700; }
  .gasoline-section {
    border: 1pt solid #888;
    border-radius: 2pt;
    margin-top: 5pt;
    padding: 4pt 6pt;
    background: #fafafa;
  }
  .gasoline-note {
    font-size: 7pt;
    color: #555;
    margin-bottom: 3pt;
  }
  .gasoline-formula {
    font-size: 9pt;
    display: flex;
    align-items: center;
    gap: 3pt;
    flex-wrap: wrap;
  }
  .gasoline-blank {
    display: inline-block;
    border-bottom: 1pt solid #000;
    min-width: 50pt;
    height: 11pt;
  }
  .gasoline-total-blank {
    display: inline-block;
    border-bottom: 1pt solid #000;
    min-width: 70pt;
    height: 11pt;
  }
  .footer {
    border-top: 1pt solid #ccc;
    margin-top: 4pt;
    padding-top: 2pt;
    display: flex;
    justify-content: space-between;
    font-size: 6pt;
    color: #888;
  }
</style>
</head>
<body>
  <div class="title">車両運行日報</div>
  <div class="info-grid">
    <div>
      <div class="info-label">運転者名</div>
      <div class="info-value">${driverName || "　"}</div>
    </div>
    <div>
      <div class="info-label">車両番号</div>
      <div class="info-value">${vehicleNumber || "　"}</div>
    </div>
  </div>
  <div class="period">対象期間：${cycleInfo.start} 〜 ${cycleInfo.end}</div>
  <table>
    <thead>
      <tr>
        <th style="width:13%">日付</th>
        <th style="width:11%">出発時間</th>
        <th style="width:11%">終了時間</th>
        <th style="width:15%">出発時距離(km)</th>
        <th style="width:15%">終了時距離(km)</th>
        <th style="width:13%">走行距離(km)</th>
        <th style="width:22%">備考</th>
      </tr>
    </thead>
    <tbody>${emptyRow}${tableRows}</tbody>
  </table>
  <div class="summary">
    <div><span class="total-label">記録日数：</span><span class="total-value">${records.length} 日</span></div>
    <div><span class="total-label">総走行距離：</span><span class="total-value">${totalDistance.toFixed(1)} km</span></div>
  </div>
  <div class="gasoline-section">
    <div class="gasoline-note">※給与計算担当者記載</div>
    <div class="gasoline-formula">
      <span>ガソリン代：</span>
      <span class="gasoline-blank"></span>
      <span>円（単価）×総距離数</span>
      <span style="font-weight:700">${totalDistance.toFixed(1)}</span>
      <span>km ＝</span>
      <span class="gasoline-total-blank"></span>
      <span>円</span>
    </div>
  </div>
  <div class="footer">
    <span>印刷日：${printDate}</span>
    <span>※ 帰着未入力の欄は斜体で表示しています</span>
  </div>
<script>
  window.onload = function() {
    setTimeout(function() {
      window.print();
      setTimeout(function() { window.close(); }, 500);
    }, 300);
  };
  window.addEventListener('afterprint', function() { window.close(); });
<\/script>
</body>
</html>`;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printHtml);
      printWindow.document.close();
    }
  }, [records, driverName, vehicleNumber, cycleInfo, totalDistance]);

  return (
    <VehicleLayout title="月次レポート" subtitle="1ヶ月分の運行記録">

      {/* サイクル選択UI */}
      <div className="card-elegant mb-6 p-4">
        <p className="text-xs text-muted-foreground mb-3 font-medium">対象サイクルを選択</p>

        {/* セレクトボックス */}
        <select
          value={activeCycleId ?? ""}
          onChange={(e) => setSelectedCycleId(Number(e.target.value))}
          className="input-elegant text-sm mb-3"
        >
          {cycleOptions.length === 0 && (
            <option value="">読み込み中...</option>
          )}
          {cycleOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>

        {/* 前後ナビゲーション */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={goToPrev}
            disabled={currentIndex >= cycleOptions.length - 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-40"
            style={{ backgroundColor: '#f3f4f6', color: '#374151' }}
          >
            <ChevronLeft className="h-4 w-4" />
            前のサイクル
          </button>

          <span className="text-sm font-medium text-center flex-1" style={{ color: '#1d4ed8' }}>
            {cycleInfo.start && cycleInfo.end
              ? `${cycleInfo.start} 〜 ${cycleInfo.end}`
              : "読み込み中..."}
            {activeCycleId === currentCycle?.id && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#dbeafe', color: '#1d4ed8' }}>
                今月
              </span>
            )}
          </span>

          <button
            onClick={goToNext}
            disabled={currentIndex <= 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-40"
            style={{ backgroundColor: '#f3f4f6', color: '#374151' }}
          >
            次のサイクル
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* レポート本体 */}
      <div className="bg-white p-6 rounded-lg border border-border shadow-sm">
        {/* ヘッダー */}
        <div className="mb-4 border-b-2 pb-3" style={{ borderColor: "#333" }}>
          <h2 className="text-xl font-bold text-center mb-2" style={{ color: "#000" }}>
            車両運行日報
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p style={{ color: "#666" }}>運転者名</p>
              <p className="font-semibold text-base" style={{ color: "#000" }}>
                {driverName || "-"}
              </p>
            </div>
            <div>
              <p style={{ color: "#666" }}>車両番号</p>
              <p className="font-semibold text-base" style={{ color: "#000" }}>
                {vehicleNumber || "-"}
              </p>
            </div>
          </div>
          <div className="mt-2 text-center text-sm">
            <p style={{ color: "#666" }}>
              対象期間: {cycleInfo.start} 〜 {cycleInfo.end}
            </p>
          </div>
        </div>

        {/* テーブル */}
        <div className="overflow-x-auto mb-4">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {["日付", "出発時間", "終了時間", "出発距離", "終了距離", "走行距離", "備考"].map((h) => (
                  <th
                    key={h}
                    className="border px-2 py-2 font-bold text-xs"
                    style={{ backgroundColor: "#e5e5e5", borderColor: "#333", color: "#000" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="border px-2 py-8 text-xs text-center"
                    style={{ color: "#888", borderColor: "#333" }}
                  >
                    記録がありません
                  </td>
                </tr>
              ) : (
                records.map((record, idx) => {
                  const depDist =
                    typeof record.departureDistance === "string"
                      ? parseFloat(record.departureDistance)
                      : (record.departureDistance as number);
                  const arrDist =
                    record.arrivalDistance == null
                      ? null
                      : typeof record.arrivalDistance === "string"
                        ? parseFloat(record.arrivalDistance)
                        : (record.arrivalDistance as number);
                  const distance = calculateDistance(depDist, arrDist);
                  const incomplete = arrDist == null;

                  return (
                    <tr key={idx}>
                      <td className="border px-2 py-1 text-xs" style={{ color: "#000", borderColor: "#333" }}>
                        {formatDateJP(record.recordDate)}
                      </td>
                      <td className="border px-2 py-1 text-xs text-center" style={{ color: "#000", borderColor: "#333" }}>
                        {record.departureTime}
                      </td>
                      <td className="border px-2 py-1 text-xs text-center" style={{ color: incomplete ? "#f59e0b" : "#000", borderColor: "#333" }}>
                        {record.arrivalTime ?? "未入力"}
                      </td>
                      <td className="border px-2 py-1 text-xs text-right" style={{ color: "#000", borderColor: "#333" }}>
                        {depDist.toFixed(1)}
                      </td>
                      <td className="border px-2 py-1 text-xs text-right" style={{ color: incomplete ? "#f59e0b" : "#000", borderColor: "#333" }}>
                        {arrDist != null ? arrDist.toFixed(1) : "-"}
                      </td>
                      <td className="border px-2 py-1 text-xs text-right font-semibold" style={{ color: incomplete ? "#f59e0b" : "#000", borderColor: "#333" }}>
                        {arrDist != null ? distance.toFixed(1) : "-"}
                      </td>
                      <td className="border px-2 py-1 text-xs" style={{ color: "#444", borderColor: "#333", wordBreak: "break-all" }}>
                        {record.notes ?? ""}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 合計 */}
        <div className="border-t-2 pt-3" style={{ borderColor: "#333" }}>
          <div className="flex justify-between items-center">
            <p style={{ color: "#000" }}>
              記録日数: <span className="font-bold text-lg">{records.length}日</span>
            </p>
            <p style={{ color: "#000" }}>
              総走行距離: <span className="font-bold text-lg">{totalDistance.toFixed(1)} km</span>
            </p>
          </div>
        </div>
      </div>

      {/* アクションボタン */}
      <div className="mt-8">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 py-3 rounded-lg font-medium shadow-md transition-all text-white"
            style={{ backgroundColor: "#1d4ed8" }}
          >
            <Printer className="h-5 w-5" />
            印刷
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={isPdfLoading || !activeCycleId}
            className="flex items-center justify-center gap-2 py-3 rounded-lg font-medium shadow-md transition-all text-white disabled:opacity-50"
            style={{ backgroundColor: isPdfLoading ? "#6b7280" : "#059669" }}
          >
            <Download className="h-5 w-5" />
            {isPdfLoading ? "生成中..." : "PDFダウンロード"}
          </button>
        </div>

        <Link
          href="/"
          className="btn-secondary flex items-center justify-center gap-2 py-3 w-full"
        >
          <ArrowLeft className="h-5 w-5" />
          ホーム
        </Link>

        <p className="mt-3 text-xs text-center" style={{ color: "#888" }}>
          ※「印刷」はブラウザの印刷機能を使用します。「PDFダウンロード」はPDFファイルを直接保存します。
        </p>
      </div>
    </VehicleLayout>
  );
}
