import { useEffect, useState, useCallback, useMemo } from "react";
import VehicleLayout from "@/components/VehicleLayout";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ArrowLeft, Printer, ChevronLeft, ChevronRight } from "lucide-react";

interface ReportRecord {
  id?: number;
  recordDate: string | Date;
  departureTime: string;
  arrivalTime: string | null;
  departureDistance: number | string;
  arrivalDistance: number | string | null;
  cycleId?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface CycleOption {
  id: number;
  cycleStartDate: string | Date;
  cycleEndDate: string | Date;
  label: string;
}

export default function MonthlyReport() {
  const [records, setRecords] = useState<ReportRecord[]>([]);
  const [driverName, setDriverName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);

  const { data: currentCycle } = trpc.vehicle.getCurrentCycle.useQuery();
  const { data: allCycles } = trpc.vehicle.getCycles.useQuery();
  const { data: driver } = trpc.vehicle.getDriver.useQuery();
  const { data: vehicle } = trpc.vehicle.getVehicle.useQuery();

  // 表示対象のサイクルID（選択中 or 現在のサイクル）
  const activeCycleId = selectedCycleId ?? currentCycle?.id ?? null;

  const { data: fetchedRecords } = trpc.vehicle.getRecords.useQuery(
    activeCycleId ? { cycleId: activeCycleId } : { cycleId: 0 },
    { enabled: !!activeCycleId }
  );

  // サイクル選択肢（新しい順）
  const cycleOptions = useMemo<CycleOption[]>(() => {
    if (!allCycles) return [];
    return [...allCycles]
      .sort((a, b) => new Date(b.cycleStartDate).getTime() - new Date(a.cycleStartDate).getTime())
      .map((c) => {
        const start = new Date(c.cycleStartDate).toLocaleDateString("ja-JP");
        const end = new Date(c.cycleEndDate).toLocaleDateString("ja-JP");
        const isCurrentCycle = c.id === currentCycle?.id;
        return {
          id: c.id,
          cycleStartDate: c.cycleStartDate,
          cycleEndDate: c.cycleEndDate,
          label: isCurrentCycle ? `${start} 〜 ${end}（今月）` : `${start} 〜 ${end}`,
        };
      });
  }, [allCycles, currentCycle?.id]);

  // 現在選択中のサイクル情報
  const activeCycle = useMemo(() => {
    if (!allCycles || !activeCycleId) return currentCycle ?? null;
    return allCycles.find((c) => c.id === activeCycleId) ?? currentCycle ?? null;
  }, [allCycles, activeCycleId, currentCycle]);

  const cycleInfo = useMemo(() => {
    if (!activeCycle) return { start: "", end: "" };
    return {
      start: new Date(activeCycle.cycleStartDate).toLocaleDateString("ja-JP"),
      end: new Date(activeCycle.cycleEndDate).toLocaleDateString("ja-JP"),
    };
  }, [activeCycle]);

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

  // 初期選択：現在のサイクルを選択
  useEffect(() => {
    if (currentCycle?.id && selectedCycleId === null) {
      setSelectedCycleId(currentCycle.id);
    }
  }, [currentCycle?.id, selectedCycleId]);

  useEffect(() => {
    if (fetchedRecords && activeCycleId) {
      setRecords(
        fetchedRecords.map((r) => ({
          ...r,
          recordDate:
            r.recordDate instanceof Date
              ? r.recordDate.toISOString().split("T")[0]
              : r.recordDate,
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
      const dateStr = new Date(record.recordDate).toLocaleDateString("ja-JP");

      const incompleteClass = arrDist == null ? ' class="incomplete"' : '';
      return `<tr>
        <td>${dateStr}</td>
        <td style="text-align:center">${record.departureTime}</td>
        <td style="text-align:center"${incompleteClass}>${arrDist != null ? record.arrivalTime ?? "未入力" : "未入力"}</td>
        <td style="text-align:right">${depDist.toFixed(1)}</td>
        <td style="text-align:right"${incompleteClass}>${arrDist != null ? arrDist.toFixed(1) : "-"}</td>
        <td style="text-align:right;font-weight:600"${incompleteClass}>${arrDist != null ? distance.toFixed(1) : "-"}</td>
      </tr>`;
    }).join("");

    const emptyRow =
      records.length === 0
        ? `<tr><td colspan="6" style="text-align:center;padding:20px;color:#888">記録がありません</td></tr>`
        : "";

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
        <th style="width:16%">日付</th>
        <th style="width:14%">出発時間</th>
        <th style="width:14%">終了時間</th>
        <th style="width:19%">出発時距離(km)</th>
        <th style="width:19%">終了時距離(km)</th>
        <th style="width:18%">走行距離(km)</th>
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
    <span>印刷日：${new Date().toLocaleDateString("ja-JP")}</span>
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
                {["日付", "出発時間", "終了時間", "出発距離", "終了距離", "走行距離"].map((h) => (
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
                    colSpan={6}
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
                        {new Date(record.recordDate).toLocaleDateString("ja-JP")}
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
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 py-3 rounded-lg font-medium shadow-md transition-all text-white"
            style={{ backgroundColor: "#1d4ed8" }}
          >
            <Printer className="h-5 w-5" />
            印刷
          </button>

          <Link
            href="/"
            className="btn-secondary flex items-center justify-center gap-2 py-3"
          >
            <ArrowLeft className="h-5 w-5" />
            ホーム
          </Link>
        </div>
        <p className="mt-3 text-xs text-center" style={{ color: "#888" }}>
          ※ 印刷画面で「PDFに保存」を選択するとPDFとして保存できます
        </p>
      </div>
    </VehicleLayout>
  );
}
