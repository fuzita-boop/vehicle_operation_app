import { useState, useEffect } from "react";
import VehicleLayout from "@/components/VehicleLayout";
import { trpc } from "@/lib/trpc";
import { Calendar, Plus, FileText } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const [driverName, setDriverName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [isEditingDriver, setIsEditingDriver] = useState(false);
  const [isEditingVehicle, setIsEditingVehicle] = useState(false);

  // Query current driver and vehicle
  const { data: driver } = trpc.vehicle.getDriver.useQuery();
  const { data: vehicle } = trpc.vehicle.getVehicle.useQuery();
  const { data: currentCycle } = trpc.vehicle.getCurrentCycle.useQuery();

  // Mutations
  const setDriverMutation = trpc.vehicle.setDriver.useMutation();
  const setVehicleMutation = trpc.vehicle.setVehicle.useMutation();

  // Initialize form with existing data
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

  const handleSaveDriver = async () => {
    if (driverName.trim()) {
      await setDriverMutation.mutateAsync({ driverName });
      setIsEditingDriver(false);
    }
  };

  const handleSaveVehicle = async () => {
    if (vehicleNumber.trim()) {
      await setVehicleMutation.mutateAsync({ vehicleNumber });
      setIsEditingVehicle(false);
    }
  };

  const cycleStartDate = currentCycle?.cycleStartDate
    ? new Date(currentCycle.cycleStartDate).toLocaleDateString("ja-JP")
    : "-";
  const cycleEndDate = currentCycle?.cycleEndDate
    ? new Date(currentCycle.cycleEndDate).toLocaleDateString("ja-JP")
    : "-";

  return (
    <VehicleLayout
      title="車両運行日報"
      subtitle={`現在のサイクル: ${cycleStartDate} 〜 ${cycleEndDate}`}
    >
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Driver Information Card */}
        <div className="card-elegant">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">運転者情報</h2>
            {!isEditingDriver && (
              <button
                onClick={() => setIsEditingDriver(true)}
                className="px-3 py-1 text-sm font-semibold bg-accent text-accent-foreground rounded-md hover:shadow-md transition-all"
              >
                編集
              </button>
            )}
          </div>

          {isEditingDriver ? (
            <div className="space-y-3">
              <input
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="運転者名を入力"
                className="input-elegant"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveDriver}
                  className="btn-primary flex-1"
                  disabled={setDriverMutation.isPending}
                >
                  {setDriverMutation.isPending ? "保存中..." : "保存"}
                </button>
                <button
                  onClick={() => {
                    setIsEditingDriver(false);
                    setDriverName(driver?.driverName || "");
                  }}
                  className="btn-secondary flex-1"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-2xl font-bold text-accent">
                {driverName || "未設定"}
              </p>
            </div>
          )}
        </div>

        {/* Vehicle Information Card */}
        <div className="card-elegant">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">車両情報</h2>
            {!isEditingVehicle && (
              <button
                onClick={() => setIsEditingVehicle(true)}
                className="px-3 py-1 text-sm font-semibold bg-accent text-accent-foreground rounded-md hover:shadow-md transition-all"
              >
                編集
              </button>
            )}
          </div>

          {isEditingVehicle ? (
            <div className="space-y-3">
              <input
                type="text"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                placeholder="車両番号を入力"
                className="input-elegant"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveVehicle}
                  className="btn-primary flex-1"
                  disabled={setVehicleMutation.isPending}
                >
                  {setVehicleMutation.isPending ? "保存中..." : "保存"}
                </button>
                <button
                  onClick={() => {
                    setIsEditingVehicle(false);
                    setVehicleNumber(vehicle?.vehicleNumber || "");
                  }}
                  className="btn-secondary flex-1"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-2xl font-bold text-accent">
                {vehicleNumber || "未設定"}
              </p>
            </div>
          )}
        </div>

        {/* Current Cycle Card */}
        <div className="card-elegant">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold text-foreground">現在のサイクル</h2>
          </div>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              開始: <span className="font-semibold text-foreground">{cycleStartDate}</span>
            </p>
            <p className="text-muted-foreground">
              終了: <span className="font-semibold text-foreground">{cycleEndDate}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Link href="/daily-record">
          <a className="card-elegant text-center py-8 hover:shadow-lg transition-all cursor-pointer">
            <Plus className="h-8 w-8 text-accent mx-auto mb-2" />
            <h3 className="text-lg font-semibold text-foreground">本日の記録を入力</h3>
            <p className="text-sm text-muted-foreground mt-1">
              出発時間・終了時間・走行距離を記録
            </p>
          </a>
        </Link>

        <Link href="/monthly-report">
          <a className="card-elegant text-center py-8 hover:shadow-lg transition-all cursor-pointer">
            <FileText className="h-8 w-8 text-accent mx-auto mb-2" />
            <h3 className="text-lg font-semibold text-foreground">月次レポート</h3>
            <p className="text-sm text-muted-foreground mt-1">
              1ヶ月分の記録を表示・印刷
            </p>
          </a>
        </Link>
      </div>
    </VehicleLayout>
  );
}
