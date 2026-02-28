import { useEffect, useState, useRef, useCallback } from "react";
import VehicleLayout from "@/components/VehicleLayout";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ArrowLeft, Printer, FileDown, ImageDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

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

  const getFileName = useCallback(() => {
    const period =
      cycleInfo.start && cycleInfo.end
        ? `${cycleInfo.start}-${cycleInfo.end}`.replace(/\//g, "")
        : new Date().toISOString().split("T")[0];
    return `車両運行日報_${driverName || "未設定"}_${period}`;
  }, [cycleInfo, driverName]);

  // Build a pure-HTML string with only hex/rgb colors (no oklch) for html2canvas
  const buildReportHtml = useCallback(() => {
    const rows = records
      .map((record) => {
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
          <td style="border:1px solid #000;padding:4px 8px;font-size:11px;">${dateStr}</td>
          <td style="border:1px solid #000;padding:4px 8px;font-size:11px;text-align:center;">${record.departureTime}</td>
          <td style="border:1px solid #000;padding:4px 8px;font-size:11px;text-align:center;">${record.arrivalTime}</td>
          <td style="border:1px solid #000;padding:4px 8px;font-size:11px;text-align:right;">${depDist.toFixed(1)}</td>
          <td style="border:1px solid #000;padding:4px 8px;font-size:11px;text-align:right;">${arrDist.toFixed(1)}</td>
          <td style="border:1px solid #000;padding:4px 8px;font-size:11px;text-align:right;font-weight:600;">${distance.toFixed(1)}</td>
        </tr>`;
      })
      .join("");

    const emptyRow =
      records.length === 0
        ? `<tr><td colspan="6" style="border:1px solid #000;padding:16px 8px;font-size:11px;text-align:center;color:#888;">記録がありません</td></tr>`
        : "";

    return `
      <div style="width:700px;padding:32px;background:#fff;color:#000;font-family:'Noto Sans JP',sans-serif;">
        <div style="margin-bottom:12px;border-bottom:2px solid #000;padding-bottom:8px;">
          <h1 style="font-size:20px;font-weight:700;text-align:center;margin:0 0 8px 0;">車両運行日報</h1>
          <div style="display:flex;gap:32px;font-size:12px;">
            <div style="flex:1;">
              <p style="color:#888;margin:0;">運転者名</p>
              <p style="font-weight:600;margin:2px 0 0 0;">${driverName || "-"}</p>
            </div>
            <div style="flex:1;">
              <p style="color:#888;margin:0;">車両番号</p>
              <p style="font-weight:600;margin:2px 0 0 0;">${vehicleNumber || "-"}</p>
            </div>
          </div>
          <div style="text-align:center;font-size:12px;margin-top:4px;">
            <p style="color:#888;margin:0;">対象期間: ${cycleInfo.start} 〜 ${cycleInfo.end}</p>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
          <thead>
            <tr>
              <th style="border:1px solid #000;padding:6px 8px;background:#e5e5e5;font-weight:700;font-size:11px;">日付</th>
              <th style="border:1px solid #000;padding:6px 8px;background:#e5e5e5;font-weight:700;font-size:11px;">出発時間</th>
              <th style="border:1px solid #000;padding:6px 8px;background:#e5e5e5;font-weight:700;font-size:11px;">終了時間</th>
              <th style="border:1px solid #000;padding:6px 8px;background:#e5e5e5;font-weight:700;font-size:11px;">出発走行距離</th>
              <th style="border:1px solid #000;padding:6px 8px;background:#e5e5e5;font-weight:700;font-size:11px;">終了走行距離</th>
              <th style="border:1px solid #000;padding:6px 8px;background:#e5e5e5;font-weight:700;font-size:11px;">走行距離</th>
            </tr>
          </thead>
          <tbody>
            ${emptyRow}${rows}
          </tbody>
        </table>
        <div style="border-top:2px solid #000;padding-top:8px;display:flex;gap:32px;font-size:12px;">
          <div style="flex:1;">
            <p style="color:#888;margin:0;">記録日数</p>
            <p style="font-size:18px;font-weight:700;margin:2px 0 0 0;">${records.length}</p>
          </div>
          <div style="flex:1;">
            <p style="color:#888;margin:0;">総走行距離</p>
            <p style="font-size:18px;font-weight:700;margin:2px 0 0 0;">${totalDistance.toFixed(1)} km</p>
          </div>
        </div>
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid #ccc;font-size:11px;color:#888;text-align:center;">
          <p style="margin:0;">印刷日: ${new Date().toLocaleDateString("ja-JP")}</p>
        </div>
      </div>
    `;
  }, [records, driverName, vehicleNumber, cycleInfo, totalDistance]);

  const captureReportCanvas = useCallback(
    async (scale: number) => {
      const html2canvas = (await import("html2canvas")).default;

      // Create an offscreen container with pure RGB/hex styles
      const container = document.createElement("div");
      container.style.position = "absolute";
      container.style.left = "-9999px";
      container.style.top = "0";
      container.innerHTML = buildReportHtml();
      document.body.appendChild(container);

      try {
        const canvas = await html2canvas(container.firstElementChild as HTMLElement, {
          scale,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        });
        return canvas;
      } finally {
        document.body.removeChild(container);
      }
    },
    [buildReportHtml]
  );

  const handleDownloadPdf = useCallback(async () => {
    setIsGeneratingPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      const canvas = await captureReportCanvas(2);

      const a4Width = 210;
      const a4Height = 297;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const imgData = canvas.toDataURL("image/png");
      const imgWidth = a4Width;
      const imgHeight = (canvas.height * a4Width) / canvas.width;

      if (imgHeight > a4Height) {
        const scale = a4Height / imgHeight;
        const scaledWidth = imgWidth * scale;
        const offsetX = (a4Width - scaledWidth) / 2;
        pdf.addImage(imgData, "PNG", offsetX, 0, scaledWidth, a4Height);
      } else {
        pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      }

      pdf.save(`${getFileName()}.pdf`);
      toast.success("PDFをダウンロードしました");
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("PDF生成に失敗しました");
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [getFileName, captureReportCanvas]);

  const handleDownloadImage = useCallback(async () => {
    setIsGeneratingImage(true);
    try {
      const canvas = await captureReportCanvas(3);
      const link = document.createElement("a");
      link.download = `${getFileName()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("画像をダウンロードしました");
    } catch (error) {
      console.error("Image generation error:", error);
      toast.error("画像生成に失敗しました");
    } finally {
      setIsGeneratingImage(false);
    }
  }, [getFileName, captureReportCanvas]);

  return (
    <VehicleLayout title="月次レポート" subtitle="1ヶ月分の運行記録">
      {/* Print Container - visible report */}
      <div
        ref={reportRef}
        className="print-container bg-white p-8 rounded-lg border border-border shadow-sm"
      >
        {/* Header */}
        <div className="mb-3 border-b-2 border-black pb-2">
          <h1 className="text-xl font-bold text-center mb-1" style={{ color: "#000" }}>
            車両運行日報
          </h1>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p style={{ color: "#888" }}>運転者名</p>
              <p className="font-semibold" style={{ color: "#000" }}>
                {driverName || "-"}
              </p>
            </div>
            <div>
              <p style={{ color: "#888" }}>車両番号</p>
              <p className="font-semibold" style={{ color: "#000" }}>
                {vehicleNumber || "-"}
              </p>
            </div>
          </div>
          <div className="mt-1 text-center text-xs">
            <p style={{ color: "#888" }}>
              対象期間: {cycleInfo.start} 〜 {cycleInfo.end}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto mb-3 flex-1">
          <table className="print-table w-full border-collapse">
            <thead>
              <tr>
                <th className="border border-black px-2 py-2 bg-gray-200 font-bold text-xs">
                  日付
                </th>
                <th className="border border-black px-2 py-2 bg-gray-200 font-bold text-xs">
                  出発時間
                </th>
                <th className="border border-black px-2 py-2 bg-gray-200 font-bold text-xs">
                  終了時間
                </th>
                <th className="border border-black px-2 py-2 bg-gray-200 font-bold text-xs">
                  出発走行距離
                </th>
                <th className="border border-black px-2 py-2 bg-gray-200 font-bold text-xs">
                  終了走行距離
                </th>
                <th className="border border-black px-2 py-2 bg-gray-200 font-bold text-xs">
                  走行距離
                </th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="border border-black px-2 py-8 text-xs text-center"
                    style={{ color: "#888" }}
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
                      <td className="border border-black px-2 py-1 text-xs">
                        {new Date(record.recordDate).toLocaleDateString("ja-JP")}
                      </td>
                      <td className="border border-black px-2 py-1 text-xs text-center">
                        {record.departureTime}
                      </td>
                      <td className="border border-black px-2 py-1 text-xs text-center">
                        {record.arrivalTime}
                      </td>
                      <td className="border border-black px-2 py-1 text-xs text-right">
                        {depDist.toFixed(1)}
                      </td>
                      <td className="border border-black px-2 py-1 text-xs text-right">
                        {arrDist.toFixed(1)}
                      </td>
                      <td className="border border-black px-2 py-1 text-xs text-right font-semibold">
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
        <div className="border-t-2 border-black pt-2">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p style={{ color: "#888" }}>記録日数</p>
              <p className="text-lg font-bold" style={{ color: "#000" }}>
                {records.length}
              </p>
            </div>
            <div>
              <p style={{ color: "#888" }}>総走行距離</p>
              <p className="text-lg font-bold" style={{ color: "#000" }}>
                {totalDistance.toFixed(1)} km
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="mt-2 pt-2 border-t text-xs text-center"
          style={{ borderColor: "#ccc", color: "#888" }}
        >
          <p>印刷日: {new Date().toLocaleDateString("ja-JP")}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 no-print">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => window.print()}
            className="btn-primary flex items-center justify-center gap-2 py-3"
          >
            <Printer className="h-5 w-5" />
            印刷
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="flex items-center justify-center gap-2 py-3 rounded-lg font-medium shadow-md transition-all text-white"
            style={{ backgroundColor: isGeneratingPdf ? "#999" : "#dc2626" }}
          >
            {isGeneratingPdf ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <FileDown className="h-5 w-5" />
            )}
            {isGeneratingPdf ? "生成中..." : "PDF"}
          </button>

          <button
            onClick={handleDownloadImage}
            disabled={isGeneratingImage}
            className="flex items-center justify-center gap-2 py-3 rounded-lg font-medium shadow-md transition-all text-white"
            style={{ backgroundColor: isGeneratingImage ? "#999" : "#16a34a" }}
          >
            {isGeneratingImage ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ImageDown className="h-5 w-5" />
            )}
            {isGeneratingImage ? "生成中..." : "画像"}
          </button>

          <Link
            href="/"
            className="btn-secondary flex items-center justify-center gap-2 py-3"
          >
            <ArrowLeft className="h-5 w-5" />
            ホーム
          </Link>
        </div>
      </div>
    </VehicleLayout>
  );
}
