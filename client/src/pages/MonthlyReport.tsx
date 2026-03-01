import { useEffect, useState, useCallback } from "react";
import VehicleLayout from "@/components/VehicleLayout";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ArrowLeft, Printer } from "lucide-react";

interface ReportRecord {
  id?: number;
  recordDate: string | Date;
  departureTime: string;
  arrivalTime: string;
  departureDistance: number | string;
  arrivalDistance: number | string;
  cycleId?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export default function MonthlyReport() {
  const [records, setRecords] = useState<ReportRecord[]>([]);
  const [driverName, setDriverName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [cycleInfo, setCycleInfo] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  });

  const { data: currentCycle } = trpc.vehicle.getCurrentCycle.useQuery();
  const { data: driver } = trpc.vehicle.getDriver.useQuery();
  const { data: vehicle } = trpc.vehicle.getVehicle.useQuery();
  const { data: initialRecords } = trpc.vehicle.getRecords.useQuery(
    currentCycle?.id ? { cycleId: currentCycle.id } : { cycleId: 0 },
    { enabled: !!currentCycle?.id }
  );

  useEffect(() => {
    if (driver?.driverName) setDriverName(driver.driverName);
  }, [driver]);

  useEffect(() => {
    if (vehicle?.vehicleNumber) setVehicleNumber(vehicle.vehicleNumber);
  }, [vehicle]);

  useEffect(() => {
    if (currentCycle?.cycleStartDate && currentCycle?.cycleEndDate) {
      setCycleInfo({
        start: new Date(currentCycle.cycleStartDate).toLocaleDateString("ja-JP"),
        end: new Date(currentCycle.cycleEndDate).toLocaleDateString("ja-JP"),
      });
    }
  }, [currentCycle]);

  useEffect(() => {
    if (initialRecords && currentCycle?.id) {
      setRecords(
        initialRecords.map((r) => ({
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
            typeof r.arrivalDistance === "string"
              ? parseFloat(r.arrivalDistance)
              : r.arrivalDistance,
        }))
      );
    }
  }, [initialRecords, currentCycle?.id]);

  const calculateDistance = (departure: number, arrival: number) => {
    return Math.max(0, arrival - departure);
  };

  const totalDistance = records.reduce((sum, record) => {
    const depDist =
      typeof record.departureDistance === "string"
        ? parseFloat(record.departureDistance)
        : record.departureDistance;
    const arrDist =
      typeof record.arrivalDistance === "string"
        ? parseFloat(record.arrivalDistance)
        : record.arrivalDistance;
    return sum + calculateDistance(depDist, arrDist);
  }, 0);

  // Generate standalone print HTML with NO external dependencies
  const handlePrint = useCallback(() => {
    const tableRows = records.map((record) => {
      const depDist =
        typeof record.departureDistance === "string"
          ? parseFloat(record.departureDistance)
          : record.departureDistance;
      const arrDist =
        typeof record.arrivalDistance === "string"
          ? parseFloat(record.arrivalDistance)
          : record.arrivalDistance;
      const distance = calculateDistance(depDist, arrDist);
      const dateStr = new Date(record.recordDate).toLocaleDateString("ja-JP");

      return `<tr>
        <td>${dateStr}</td>
        <td style="text-align:center">${record.departureTime}</td>
        <td style="text-align:center">${record.arrivalTime}</td>
        <td style="text-align:right">${depDist.toFixed(1)}</td>
        <td style="text-align:right">${arrDist.toFixed(1)}</td>
        <td style="text-align:right;font-weight:600">${distance.toFixed(1)}</td>
      </tr>`;
    }).join("");

    const emptyRow = records.length === 0
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
    margin: 8mm;
  }
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  html, body {
    width: 100%;
    height: 100%;
    font-family: "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif;
    font-size: 11px;
    line-height: 1.3;
    color: #000;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 194mm;
    max-height: 281mm;
    margin: 0 auto;
    overflow: hidden;
  }
  .title {
    text-align: center;
    font-size: 18px;
    font-weight: 700;
    padding: 4px 0;
    border-bottom: 2px solid #000;
    margin-bottom: 6px;
  }
  .info-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 2px;
    font-size: 11px;
  }
  .info-row .label {
    color: #555;
    font-size: 10px;
  }
  .info-row .value {
    font-weight: 600;
  }
  .period {
    text-align: center;
    font-size: 10px;
    color: #555;
    margin-bottom: 6px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
    table-layout: fixed;
  }
  th, td {
    border: 1px solid #000;
    padding: 3px 4px;
    overflow: hidden;
    white-space: nowrap;
  }
  th {
    background-color: #e5e5e5;
    font-weight: 700;
    text-align: center;
    font-size: 10px;
  }
  .summary {
    border-top: 2px solid #000;
    margin-top: 6px;
    padding-top: 4px;
    display: flex;
    justify-content: space-between;
    font-size: 11px;
  }
  .summary .total-value {
    font-size: 14px;
    font-weight: 700;
  }
  .footer {
    border-top: 1px solid #ccc;
    margin-top: 4px;
    padding-top: 3px;
    text-align: center;
    font-size: 9px;
    color: #888;
  }
</style>
</head>
<body>
<div class="page">
  <div class="title">車両運行日報</div>
  <div class="info-row">
    <div><span class="label">運転者名: </span><span class="value">${driverName || "-"}</span></div>
    <div><span class="label">車両番号: </span><span class="value">${vehicleNumber || "-"}</span></div>
  </div>
  <div class="period">対象期間: ${cycleInfo.start} 〜 ${cycleInfo.end}</div>
  <table>
    <thead>
      <tr>
        <th style="width:18%">日付</th>
        <th style="width:14%">出発時間</th>
        <th style="width:14%">終了時間</th>
        <th style="width:18%">出発距離</th>
        <th style="width:18%">終了距離</th>
        <th style="width:18%">走行距離</th>
      </tr>
    </thead>
    <tbody>
      ${emptyRow}${tableRows}
    </tbody>
  </table>
  <div class="summary">
    <div>記録日数: <span class="total-value">${records.length}日</span></div>
    <div>総走行距離: <span class="total-value">${totalDistance.toFixed(1)} km</span></div>
  </div>
  <div class="footer">印刷日: ${new Date().toLocaleDateString("ja-JP")}</div>
</div>
<script>
  window.onload = function() {
    setTimeout(function() { window.print(); }, 300);
  };
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
      {/* Screen Display */}
      <div className="bg-white p-6 rounded-lg border border-border shadow-sm">
        {/* Header */}
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

        {/* Table */}
        <div className="overflow-x-auto mb-4">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border px-2 py-2 font-bold text-xs" style={{ backgroundColor: "#e5e5e5", borderColor: "#333", color: "#000" }}>
                  日付
                </th>
                <th className="border px-2 py-2 font-bold text-xs" style={{ backgroundColor: "#e5e5e5", borderColor: "#333", color: "#000" }}>
                  出発時間
                </th>
                <th className="border px-2 py-2 font-bold text-xs" style={{ backgroundColor: "#e5e5e5", borderColor: "#333", color: "#000" }}>
                  終了時間
                </th>
                <th className="border px-2 py-2 font-bold text-xs" style={{ backgroundColor: "#e5e5e5", borderColor: "#333", color: "#000" }}>
                  出発距離
                </th>
                <th className="border px-2 py-2 font-bold text-xs" style={{ backgroundColor: "#e5e5e5", borderColor: "#333", color: "#000" }}>
                  終了距離
                </th>
                <th className="border px-2 py-2 font-bold text-xs" style={{ backgroundColor: "#e5e5e5", borderColor: "#333", color: "#000" }}>
                  走行距離
                </th>
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
                      : record.departureDistance;
                  const arrDist =
                    typeof record.arrivalDistance === "string"
                      ? parseFloat(record.arrivalDistance)
                      : record.arrivalDistance;
                  const distance = calculateDistance(depDist, arrDist);

                  return (
                    <tr key={idx}>
                      <td className="border px-2 py-1 text-xs" style={{ color: "#000", borderColor: "#333" }}>
                        {new Date(record.recordDate).toLocaleDateString("ja-JP")}
                      </td>
                      <td className="border px-2 py-1 text-xs text-center" style={{ color: "#000", borderColor: "#333" }}>
                        {record.departureTime}
                      </td>
                      <td className="border px-2 py-1 text-xs text-center" style={{ color: "#000", borderColor: "#333" }}>
                        {record.arrivalTime}
                      </td>
                      <td className="border px-2 py-1 text-xs text-right" style={{ color: "#000", borderColor: "#333" }}>
                        {depDist.toFixed(1)}
                      </td>
                      <td className="border px-2 py-1 text-xs text-right" style={{ color: "#000", borderColor: "#333" }}>
                        {arrDist.toFixed(1)}
                      </td>
                      <td className="border px-2 py-1 text-xs text-right font-semibold" style={{ color: "#000", borderColor: "#333" }}>
                        {distance.toFixed(1)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Total Section */}
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

      {/* Action Buttons */}
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
