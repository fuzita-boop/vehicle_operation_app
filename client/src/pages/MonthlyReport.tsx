import { useEffect, useState } from "react";
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

  return (
    <VehicleLayout title="月次レポート" subtitle="1ヶ月分の運行記録">
      {/* Print Container */}
      <div className="print-container bg-white p-8 rounded-lg border border-border shadow-sm">
        {/* Header */}
        <div className="mb-8 border-b-2 border-black pb-4">
          <h1 className="text-3xl font-bold text-center mb-2">車両運行日報</h1>
          <div className="grid grid-cols-2 gap-8 text-sm">
            <div>
              <p className="text-muted-foreground">運転者名</p>
              <p className="text-lg font-semibold">{driverName || "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">車両番号</p>
              <p className="text-lg font-semibold">{vehicleNumber || "-"}</p>
            </div>
          </div>
          <div className="mt-4 text-center text-sm">
            <p className="text-muted-foreground">
              対象期間: {cycleInfo.start} 〜 {cycleInfo.end}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto mb-8">
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
              {records.map((record, idx) => {
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
              })}
            </tbody>
          </table>
        </div>

        {/* Total Section */}
        <div className="border-t-2 border-black pt-4">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-sm text-muted-foreground">記録日数</p>
              <p className="text-2xl font-bold">{records.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">総走行距離</p>
              <p className="text-2xl font-bold">{totalDistance.toFixed(1)} km</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-300 text-xs text-muted-foreground text-center">
          <p>印刷日: {new Date().toLocaleDateString("ja-JP")}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex gap-4 no-print">
        <button
          onClick={() => window.print()}
          className="btn-primary flex items-center gap-2"
        >
          <Printer className="h-5 w-5" />
          印刷
        </button>

        <Link href="/daily-record">
          <a className="btn-secondary flex items-center gap-2">
            <ArrowLeft className="h-5 w-5" />
            日次記録に戻る
          </a>
        </Link>

        <Link href="/">
          <a className="btn-secondary flex items-center gap-2">
            <ArrowLeft className="h-5 w-5" />
            ホームに戻る
          </a>
        </Link>
      </div>
    </VehicleLayout>
  );
}
