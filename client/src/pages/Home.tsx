import { useState, useEffect } from "react";
import VehicleLayout from "@/components/VehicleLayout";
import { trpc } from "@/lib/trpc";
import { Calendar, Plus, FileText, AlertTriangle, Bell, BellOff } from "lucide-react";
import { Link } from "wouter";
import { usePushNotification } from "@/hooks/usePushNotification";

export default function Home() {
  const [driverName, setDriverName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [isEditingDriver, setIsEditingDriver] = useState(false);
  const [isEditingVehicle, setIsEditingVehicle] = useState(false);

  // Query current driver and vehicle
  const { data: driver } = trpc.vehicle.getDriver.useQuery();
  const { data: vehicle } = trpc.vehicle.getVehicle.useQuery();
  const { data: currentCycle } = trpc.vehicle.getCurrentCycle.useQuery();
  const { data: incompleteData } = trpc.vehicle.getIncompleteCount.useQuery();

  // Push notification
  const { isSupported, permission, isSubscribed, isLoading: pushLoading, subscribe, unsubscribe } = usePushNotification();

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

  const incompleteCount = incompleteData?.count ?? 0;
  const hasIncomplete = incompleteCount > 0;

  return (
    <VehicleLayout
      title="車両運行日報"
      subtitle={`現在のサイクル: ${cycleStartDate} 〜 ${cycleEndDate}`}
    >
      {/* プッシュ通知の許可バナー（未許可かつサポートされている場合） */}
      {isSupported && permission === "default" && !isSubscribed && (
        <div
          className="mb-4 flex items-center justify-between gap-3 rounded-xl px-5 py-3"
          style={{ backgroundColor: '#eff6ff', border: '1px solid #93c5fd' }}
        >
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 shrink-0" style={{ color: '#2563eb' }} />
            <p className="text-sm" style={{ color: '#1e40af' }}>
              毎日18時に帰着未入力を通知します
            </p>
          </div>
          <button
            onClick={subscribe}
            disabled={pushLoading}
            className="shrink-0 px-3 py-1.5 text-sm font-semibold rounded-lg transition-all"
            style={{ backgroundColor: '#2563eb', color: '#fff' }}
          >
            {pushLoading ? "設定中..." : "通知を許可"}
          </button>
        </div>
      )}

      {/* 通知ON/OFFトグル（許可済みの場合） */}
      {isSupported && permission === "granted" && (
        <div
          className="mb-4 flex items-center justify-between gap-3 rounded-xl px-5 py-3"
          style={{ backgroundColor: isSubscribed ? '#f0fdf4' : '#fafafa', border: `1px solid ${isSubscribed ? '#86efac' : '#e5e7eb'}` }}
        >
          <div className="flex items-center gap-2">
            {isSubscribed ? (
              <Bell className="h-5 w-5 shrink-0" style={{ color: '#16a34a' }} />
            ) : (
              <BellOff className="h-5 w-5 shrink-0" style={{ color: '#6b7280' }} />
            )}
            <p className="text-sm" style={{ color: isSubscribed ? '#15803d' : '#6b7280' }}>
              {isSubscribed ? "18時の帰着リマインダー通知: ON" : "18時の帰着リマインダー通知: OFF"}
            </p>
          </div>
          <button
            onClick={isSubscribed ? unsubscribe : subscribe}
            disabled={pushLoading}
            className="shrink-0 px-3 py-1.5 text-sm font-semibold rounded-lg transition-all"
            style={isSubscribed
              ? { backgroundColor: '#fee2e2', color: '#b91c1c' }
              : { backgroundColor: '#2563eb', color: '#fff' }
            }
          >
            {pushLoading ? "処理中..." : isSubscribed ? "通知をOFF" : "通知をON"}
          </button>
        </div>
      )}

      {/* 帰着未入力の警告バナー */}
      {hasIncomplete && (
        <div
          className="mb-6 flex items-center gap-3 rounded-xl px-5 py-4 shadow-sm"
          style={{ backgroundColor: '#fff7ed', border: '2px solid #f97316' }}
        >
          <AlertTriangle className="h-6 w-6 shrink-0" style={{ color: '#ea580c' }} />
          <div>
            <p className="font-bold" style={{ color: '#9a3412' }}>
              帰着未入力の記録が {incompleteCount} 件あります
            </p>
            <p className="text-sm mt-0.5" style={{ color: '#c2410c' }}>
              「本日の記録を入力」から帰着情報を追加してください
            </p>
          </div>
        </div>
      )}

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
              <p className="text-2xl font-bold text-foreground">
                {driverName || <span className="text-muted-foreground">未設定</span>}
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
              <p className="text-2xl font-bold text-foreground">
                {vehicleNumber || <span className="text-muted-foreground">未設定</span>}
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
        {/* 本日の記録を入力カード：帰着未入力があればオレンジ色 */}
        <Link
          href="/daily-record"
          className="text-center py-8 hover:shadow-lg transition-all cursor-pointer block rounded-xl"
          style={
            hasIncomplete
              ? {
                  backgroundColor: '#fff7ed',
                  border: '2px solid #f97316',
                  boxShadow: '0 4px 16px rgba(249,115,22,0.15)',
                }
              : {
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }
          }
        >
          {hasIncomplete ? (
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" style={{ color: '#ea580c' }} />
          ) : (
            <Plus className="h-8 w-8 text-accent mx-auto mb-2" />
          )}
          <h3
            className="text-lg font-semibold"
            style={{ color: hasIncomplete ? '#9a3412' : 'var(--foreground)' }}
          >
            本日の記録を入力
          </h3>
          {hasIncomplete ? (
            <div className="mt-2 space-y-1">
              <span
                className="inline-block text-sm font-bold px-3 py-1 rounded-full"
                style={{ backgroundColor: '#fed7aa', color: '#9a3412' }}
              >
                ⚠ 帰着未入力 {incompleteCount}件
              </span>
              <p className="text-sm mt-1" style={{ color: '#c2410c' }}>
                帰着情報を追加してください
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">
              出発時間・終了時間・走行距離を記録
            </p>
          )}
        </Link>

        <Link href="/monthly-report" className="card-elegant text-center py-8 hover:shadow-lg transition-all cursor-pointer block">
          <FileText className="h-8 w-8 text-accent mx-auto mb-2" />
          <h3 className="text-lg font-semibold text-foreground">月次レポート</h3>
          <p className="text-sm text-muted-foreground mt-1">
            1ヶ月分の記録を表示・印刷
          </p>
        </Link>
      </div>
    </VehicleLayout>
  );
}
