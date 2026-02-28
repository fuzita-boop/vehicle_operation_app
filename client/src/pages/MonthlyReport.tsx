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
    if (driver?.driverName) {
      setDriverName(driver.driverName);
    }
  }, [driver]);

  useEffect(() => {
    if (vehicle?.vehicleNumber) {
      setVehicleNumber(vehicle.vehicleNumber);
    }
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
    const period = cycleInfo.start && cycleInfo.end
      ? `${cycleInfo.start}-${cycleInfo.end}`.replace(/\//g, "")
      : new Date().toISOString().split("T")[0];
    return `車両運行日報_${driverName || "未設定"}_${period}`;
  }, [cycleInfo, driverName]);

  // Convert OKLCH colors to RGB for html2canvas compatibility
  const convertOklchToRgb = useCallback((element: HTMLElement) => {
    const allElements = element.querySelectorAll("*");
    const originalStyles: { el: HTMLElement; prop: string; value: string }[] = [];

    const convert = (el: HTMLElement) => {
      const computed = window.getComputedStyle(el);
      const propsToCheck = [
        "color",
        "backgroundColor",
        "borderColor",
        "borderTopColor",
        "borderRightColor",
        "borderBottomColor",
        "borderLeftColor",
      ];
      propsToCheck.forEach((prop) => {
        const val = computed.getPropertyValue(prop);
        if (val && val.includes("oklch")) {
          // Create a temporary element to resolve the color
          const temp = document.createElement("div");
          temp.style.color = val;
          document.body.appendChild(temp);
          const resolved = window.getComputedStyle(temp).color;
          document.body.removeChild(temp);

          const camelProp = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          originalStyles.push({
            el,
            prop: camelProp,
            value: (el.style as any)[camelProp],
          });
          (el.style as any)[camelProp] = resolved || "#000000";
        }
      });
    };

    convert(element);
    allElements.forEach((child) => convert(child as HTMLElement));

    return () => {
      originalStyles.forEach(({ el, prop, value }) => {
        (el.style as any)[prop] = value;
      });
    };
  }, []);

  const handleDownloadPdf = useCallback(async () => {
    if (!reportRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const element = reportRef.current;
      const restoreColors = convertOklchToRgb(element);
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      restoreColors();

      // A4 dimensions in mm
      const a4Width = 210;
      const a4Height = 297;

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const imgData = canvas.toDataURL("image/png");
      const imgWidth = a4Width;
      const imgHeight = (canvas.height * a4Width) / canvas.width;

      // Scale to fit A4 if needed
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
  }, [getFileName, convertOklchToRgb]);

  const handleDownloadImage = useCallback(async () => {
    if (!reportRef.current) return;
    setIsGeneratingImage(true);
    try {
      const html2canvas = (await import("html2canvas")).default;

      const element = reportRef.current;
      const restoreColors = convertOklchToRgb(element);
      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      restoreColors();

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
  }, [getFileName, convertOklchToRgb]);

  return (
    <VehicleLayout title="月次レポート" subtitle="1ヶ月分の運行記録">
      {/* Print Container */}
      <div
        ref={reportRef}
        className="print-container bg-white p-8 rounded-lg border border-border shadow-sm"
      >
        {/* Header */}
        <div className="mb-3 border-b-2 border-black pb-2">
          <h1 className="text-xl font-bold text-center mb-1">車両運行日報</h1>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-muted-foreground">運転者名</p>
              <p className="font-semibold">{driverName || "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">車両番号</p>
              <p className="font-semibold">{vehicleNumber || "-"}</p>
            </div>
          </div>
          <div className="mt-1 text-center text-xs">
            <p className="text-muted-foreground">
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
                  <td colSpan={6} className="border border-black px-2 py-8 text-xs text-center text-muted-foreground">
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
              <p className="text-muted-foreground">記録日数</p>
              <p className="text-lg font-bold">{records.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">総走行距離</p>
              <p className="text-lg font-bold">{totalDistance.toFixed(1)} km</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-2 pt-2 border-t border-gray-300 text-xs text-muted-foreground text-center">
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
            className="btn-primary flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-700 text-white"
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
            className="btn-primary flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white"
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
