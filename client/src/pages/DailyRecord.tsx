import { useState, useEffect } from "react";
import VehicleLayout from "@/components/VehicleLayout";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ArrowLeft, Plus } from "lucide-react";

interface DailyRecordData {
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

export default function DailyRecord() {
  const [todayRecord, setTodayRecord] = useState<DailyRecordData>({
    recordDate: new Date().toISOString().split("T")[0],
    departureTime: "",
    arrivalTime: "",
    departureDistance: 0,
    arrivalDistance: 0,
  });

  const [records, setRecords] = useState<DailyRecordData[]>([]);
  const utils = trpc.useUtils();


  const { data: currentCycle } = trpc.vehicle.getCurrentCycle.useQuery();
  const addRecordMutation = trpc.vehicle.addRecord.useMutation();
  const { data: initialRecords, refetch } = trpc.vehicle.getRecords.useQuery(
    currentCycle?.id ? { cycleId: currentCycle.id } : { cycleId: 0 },
    { enabled: !!currentCycle?.id }
  );



  useEffect(() => {
    if (initialRecords && currentCycle?.id) {
      setRecords(initialRecords.map(r => ({
        ...r,
        recordDate: r.recordDate instanceof Date ? r.recordDate.toISOString().split('T')[0] : r.recordDate,
        departureDistance: typeof r.departureDistance === 'string' ? parseFloat(r.departureDistance) : r.departureDistance,
        arrivalDistance: typeof r.arrivalDistance === 'string' ? parseFloat(r.arrivalDistance) : r.arrivalDistance,
      })));
    }
  }, [initialRecords, currentCycle?.id]);

  const calculateDistance = (departure: number, arrival: number) => {
    return Math.max(0, arrival - departure);
  };

  const depDist = typeof todayRecord.departureDistance === 'string' ? parseFloat(todayRecord.departureDistance) : todayRecord.departureDistance;
  const arrDist = typeof todayRecord.arrivalDistance === 'string' ? parseFloat(todayRecord.arrivalDistance) : todayRecord.arrivalDistance;
  const todayDistance = calculateDistance(depDist, arrDist);

  const handleAddRecord = async () => {
    const depDistLocal = typeof todayRecord.departureDistance === 'string' ? parseFloat(todayRecord.departureDistance) : todayRecord.departureDistance;
    const arrDistLocal = typeof todayRecord.arrivalDistance === 'string' ? parseFloat(todayRecord.arrivalDistance) : todayRecord.arrivalDistance;
    
    if (
      !todayRecord.departureTime ||
      !todayRecord.arrivalTime ||
      isNaN(depDistLocal) ||
      isNaN(arrDistLocal) ||
      depDistLocal < 0 ||
      arrDistLocal < 0
    ) {
      alert("すべての項目を正しく入力してください");
      return;
    }

    if (!currentCycle?.id) {
      alert("サイクル情報が見つかりません");
      return;
    }

    try {
      const recordDateStr = typeof todayRecord.recordDate === 'string' ? todayRecord.recordDate : todayRecord.recordDate.toISOString().split('T')[0];
      
      console.log('Sending record:', {
        cycleId: currentCycle.id,
        recordDate: recordDateStr,
        departureTime: todayRecord.departureTime,
        arrivalTime: todayRecord.arrivalTime,
        departureDistance: depDistLocal,
        arrivalDistance: arrDistLocal,
      });
      
      await addRecordMutation.mutateAsync({
        cycleId: currentCycle.id,
        recordDate: recordDateStr,
        departureTime: todayRecord.departureTime,
        arrivalTime: todayRecord.arrivalTime,
        departureDistance: depDistLocal,
        arrivalDistance: arrDistLocal,
      });

      // Reset form
      setTodayRecord({
        recordDate: new Date().toISOString().split("T")[0],
        departureTime: "",
        arrivalTime: "",
        departureDistance: 0,
        arrivalDistance: 0,
      });

      // Reload records
      await refetch();
      alert("記録を保存しました");
    } catch (error) {
      console.error("Failed to add record:", error);
      alert("記録の保存に失敗しました: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const totalDistance = records.reduce((sum, record) => {
    const depDist = typeof record.departureDistance === 'string' ? parseFloat(record.departureDistance) : record.departureDistance;
    const arrDist = typeof record.arrivalDistance === 'string' ? parseFloat(record.arrivalDistance) : record.arrivalDistance;
    return sum + calculateDistance(depDist, arrDist);
  }, 0);

  return (
    <VehicleLayout title="日次記録入力" subtitle="毎日の運行記録を入力してください">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Input Form */}
        <div className="lg:col-span-2">
          <div className="card-elegant">
            <h2 className="text-lg font-semibold text-foreground mb-6">本日の記録</h2>

            <div className="space-y-4">
              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  記録日
                </label>
                <input
                  type="date"
                  value={typeof todayRecord.recordDate === 'string' ? todayRecord.recordDate : todayRecord.recordDate.toISOString().split('T')[0]}
                  onChange={(e) =>
                    setTodayRecord({ ...todayRecord, recordDate: e.target.value })
                  }
                  className="input-elegant"
                />
              </div>

              {/* Departure Time */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  出発時間
                </label>
                <input
                  type="time"
                  value={todayRecord.departureTime}
                  onChange={(e) =>
                    setTodayRecord({ ...todayRecord, departureTime: e.target.value })
                  }
                  className="input-elegant"
                />
              </div>

              {/* Arrival Time */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  終了時間
                </label>
                <input
                  type="time"
                  value={todayRecord.arrivalTime}
                  onChange={(e) =>
                    setTodayRecord({ ...todayRecord, arrivalTime: e.target.value })
                  }
                  className="input-elegant"
                />
              </div>

              {/* Departure Distance */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  出発時走行距離 (km)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={depDist === 0 ? "" : depDist}
                  placeholder="0"
                  onChange={(e) =>
                    setTodayRecord({
                      ...todayRecord,
                      departureDistance: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0,
                    })
                  }
                  className="input-elegant"
                />
              </div>

              {/* Arrival Distance */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  終了時走行距離 (km)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={arrDist === 0 ? "" : arrDist}
                  placeholder="0"
                  onChange={(e) =>
                    setTodayRecord({
                      ...todayRecord,
                      arrivalDistance: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0,
                    })
                  }
                  className="input-elegant"
                />
              </div>

              {/* Today's Total Distance */}
            <div className="bg-blue-50 border-2 border-blue-600 rounded-lg p-4 mt-6">
              <p className="text-sm font-medium mb-1" style={{ color: '#333' }}>本日の走行距離</p>
              <p className="text-3xl font-bold" style={{ color: '#1d4ed8' }}>{todayDistance.toFixed(1)} km</p>
            </div>

              {/* Add Button */}
              <button
                onClick={handleAddRecord}
                disabled={addRecordMutation.isPending}
                className="w-full mt-6 px-4 py-3 bg-accent text-accent-foreground font-bold text-lg rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Plus className="h-6 w-6" />
                {addRecordMutation.isPending ? "保存中..." : "記録を保存"}
              </button>
            </div>
          </div>
        </div>

        {/* Summary Card */}
        <div className="card-elegant h-fit">
          <h3 className="text-lg font-semibold text-foreground mb-4">月次合計</h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">記録数</p>
              <p className="text-2xl font-bold" style={{ color: '#1d4ed8' }}>{records.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">総走行距離</p>
              <p className="text-2xl font-bold" style={{ color: '#1d4ed8' }}>{totalDistance.toFixed(1)} km</p>
            </div>
          </div>
        </div>
      </div>

      {/* Records List */}
      {records.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">記録一覧</h3>
          <div className="overflow-x-auto">
            <table className="table-elegant">
              <thead>
                <tr>
                  <th>日付</th>
                  <th>出発時間</th>
                  <th>終了時間</th>
                  <th>出発走行距離</th>
                  <th>終了走行距離</th>
                  <th>走行距離</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record, idx) => {
                  const depDist = typeof record.departureDistance === 'string' ? parseFloat(record.departureDistance) : record.departureDistance;
                  const arrDist = typeof record.arrivalDistance === 'string' ? parseFloat(record.arrivalDistance) : record.arrivalDistance;
                  return (
                  <tr key={idx}>
                    <td>{new Date(record.recordDate).toLocaleDateString("ja-JP")}</td>
                    <td>{record.departureTime}</td>
                    <td>{record.arrivalTime}</td>
                    <td>{depDist.toFixed(1)} km</td>
                    <td>{arrDist.toFixed(1)} km</td>
                    <td className="font-semibold" style={{ color: '#1d4ed8' }}>
                      {calculateDistance(depDist, arrDist).toFixed(1)} km
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-8 flex gap-4">
        <Link href="/" className="btn-secondary flex items-center gap-2">
          <ArrowLeft className="h-5 w-5" />
          ホームに戻る
        </Link>
      </div>
    </VehicleLayout>
  );
}
