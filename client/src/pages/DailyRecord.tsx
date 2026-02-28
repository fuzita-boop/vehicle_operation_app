import { useState, useEffect } from "react";
import VehicleLayout from "@/components/VehicleLayout";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ArrowLeft, Plus, Pencil, Trash2, Check, X } from "lucide-react";

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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<DailyRecordData | null>(null);

  const { data: currentCycle } = trpc.vehicle.getCurrentCycle.useQuery();
  const addRecordMutation = trpc.vehicle.addRecord.useMutation();
  const updateRecordMutation = trpc.vehicle.updateRecord.useMutation();
  const deleteRecordMutation = trpc.vehicle.deleteRecord.useMutation();
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
      
      await addRecordMutation.mutateAsync({
        cycleId: currentCycle.id,
        recordDate: recordDateStr,
        departureTime: todayRecord.departureTime,
        arrivalTime: todayRecord.arrivalTime,
        departureDistance: depDistLocal,
        arrivalDistance: arrDistLocal,
      });

      setTodayRecord({
        recordDate: new Date().toISOString().split("T")[0],
        departureTime: "",
        arrivalTime: "",
        departureDistance: 0,
        arrivalDistance: 0,
      });

      await refetch();
      alert("記録を保存しました");
    } catch (error) {
      console.error("Failed to add record:", error);
      alert("記録の保存に失敗しました: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleStartEdit = (record: DailyRecordData) => {
    if (!record.id) return;
    setEditingId(record.id);
    const dateStr = typeof record.recordDate === 'string'
      ? record.recordDate
      : record.recordDate.toISOString().split('T')[0];
    setEditForm({
      ...record,
      recordDate: dateStr,
      departureDistance: typeof record.departureDistance === 'string' ? parseFloat(record.departureDistance) : record.departureDistance,
      arrivalDistance: typeof record.arrivalDistance === 'string' ? parseFloat(record.arrivalDistance) : record.arrivalDistance,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleSaveEdit = async () => {
    if (!editForm || !editingId) return;

    const depDistEdit = typeof editForm.departureDistance === 'string' ? parseFloat(editForm.departureDistance) : editForm.departureDistance;
    const arrDistEdit = typeof editForm.arrivalDistance === 'string' ? parseFloat(editForm.arrivalDistance) : editForm.arrivalDistance;

    if (!editForm.departureTime || !editForm.arrivalTime || isNaN(depDistEdit) || isNaN(arrDistEdit)) {
      alert("すべての項目を正しく入力してください");
      return;
    }

    try {
      const recordDateStr = typeof editForm.recordDate === 'string' ? editForm.recordDate : editForm.recordDate.toISOString().split('T')[0];
      await updateRecordMutation.mutateAsync({
        recordId: editingId,
        recordDate: recordDateStr,
        departureTime: editForm.departureTime,
        arrivalTime: editForm.arrivalTime,
        departureDistance: depDistEdit,
        arrivalDistance: arrDistEdit,
      });
      setEditingId(null);
      setEditForm(null);
      await refetch();
      alert("記録を更新しました");
    } catch (error) {
      console.error("Failed to update record:", error);
      alert("記録の更新に失敗しました: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleDeleteRecord = async (recordId: number) => {
    if (!confirm("この記録を削除してもよろしいですか？")) return;
    try {
      await deleteRecordMutation.mutateAsync({ recordId });
      await refetch();
      alert("記録を削除しました");
    } catch (error) {
      console.error("Failed to delete record:", error);
      alert("記録の削除に失敗しました: " + (error instanceof Error ? error.message : String(error)));
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
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">記録日</label>
                <input
                  type="date"
                  value={typeof todayRecord.recordDate === 'string' ? todayRecord.recordDate : todayRecord.recordDate.toISOString().split('T')[0]}
                  onChange={(e) => setTodayRecord({ ...todayRecord, recordDate: e.target.value })}
                  className="input-elegant"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">出発時間</label>
                <input
                  type="time"
                  value={todayRecord.departureTime}
                  onChange={(e) => setTodayRecord({ ...todayRecord, departureTime: e.target.value })}
                  className="input-elegant"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">終了時間</label>
                <input
                  type="time"
                  value={todayRecord.arrivalTime}
                  onChange={(e) => setTodayRecord({ ...todayRecord, arrivalTime: e.target.value })}
                  className="input-elegant"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">出発時走行距離 (km)</label>
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

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">終了時走行距離 (km)</label>
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

              <div className="bg-blue-50 border-2 border-blue-600 rounded-lg p-4 mt-6">
                <p className="text-sm font-medium mb-1" style={{ color: '#333' }}>本日の走行距離</p>
                <p className="text-3xl font-bold" style={{ color: '#1d4ed8' }}>{todayDistance.toFixed(1)} km</p>
              </div>

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
          <div className="space-y-3">
            {records.map((record, idx) => {
              const rDepDist = typeof record.departureDistance === 'string' ? parseFloat(record.departureDistance) : record.departureDistance;
              const rArrDist = typeof record.arrivalDistance === 'string' ? parseFloat(record.arrivalDistance) : record.arrivalDistance;
              const isEditing = editingId === record.id;

              if (isEditing && editForm) {
                const eDepDist = typeof editForm.departureDistance === 'string' ? parseFloat(editForm.departureDistance) : editForm.departureDistance;
                const eArrDist = typeof editForm.arrivalDistance === 'string' ? parseFloat(editForm.arrivalDistance) : editForm.arrivalDistance;
                const editDistance = calculateDistance(eDepDist, eArrDist);

                return (
                  <div key={record.id || idx} className="card-elegant border-2 border-blue-400 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold" style={{ color: '#1d4ed8' }}>記録を編集中</h4>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          disabled={updateRecordMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium text-white transition-colors disabled:opacity-50"
                          style={{ backgroundColor: '#16a34a' }}
                        >
                          <Check className="h-4 w-4" />
                          {updateRecordMutation.isPending ? "保存中..." : "保存"}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium text-white transition-colors"
                          style={{ backgroundColor: '#6b7280' }}
                        >
                          <X className="h-4 w-4" />
                          取消
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: '#555' }}>記録日</label>
                        <input
                          type="date"
                          value={typeof editForm.recordDate === 'string' ? editForm.recordDate : ''}
                          onChange={(e) => setEditForm({ ...editForm, recordDate: e.target.value })}
                          className="input-elegant text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: '#555' }}>走行距離</label>
                        <p className="text-lg font-bold mt-1" style={{ color: '#1d4ed8' }}>{editDistance.toFixed(1)} km</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: '#555' }}>出発時間</label>
                        <input
                          type="time"
                          value={editForm.departureTime}
                          onChange={(e) => setEditForm({ ...editForm, departureTime: e.target.value })}
                          className="input-elegant text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: '#555' }}>終了時間</label>
                        <input
                          type="time"
                          value={editForm.arrivalTime}
                          onChange={(e) => setEditForm({ ...editForm, arrivalTime: e.target.value })}
                          className="input-elegant text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: '#555' }}>出発走行距離 (km)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={eDepDist === 0 ? "" : eDepDist}
                          placeholder="0"
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              departureDistance: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0,
                            })
                          }
                          className="input-elegant text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: '#555' }}>終了走行距離 (km)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={eArrDist === 0 ? "" : eArrDist}
                          placeholder="0"
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              arrivalDistance: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0,
                            })
                          }
                          className="input-elegant text-sm"
                        />
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={record.id || idx} className="card-elegant p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 grid grid-cols-3 sm:grid-cols-6 gap-2 text-sm">
                      <div>
                        <p className="text-xs" style={{ color: '#888' }}>日付</p>
                        <p className="font-medium" style={{ color: '#111' }}>{new Date(record.recordDate).toLocaleDateString("ja-JP")}</p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: '#888' }}>出発</p>
                        <p className="font-medium" style={{ color: '#111' }}>{record.departureTime}</p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: '#888' }}>終了</p>
                        <p className="font-medium" style={{ color: '#111' }}>{record.arrivalTime}</p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: '#888' }}>出発距離</p>
                        <p className="font-medium" style={{ color: '#111' }}>{rDepDist.toFixed(1)}</p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: '#888' }}>終了距離</p>
                        <p className="font-medium" style={{ color: '#111' }}>{rArrDist.toFixed(1)}</p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: '#888' }}>走行距離</p>
                        <p className="font-bold" style={{ color: '#1d4ed8' }}>{calculateDistance(rDepDist, rArrDist).toFixed(1)} km</p>
                      </div>
                    </div>
                    <div className="flex gap-1 ml-3 shrink-0">
                      <button
                        onClick={() => handleStartEdit(record)}
                        className="p-2 rounded-md transition-colors hover:bg-blue-50"
                        title="編集"
                      >
                        <Pencil className="h-4 w-4" style={{ color: '#1d4ed8' }} />
                      </button>
                      <button
                        onClick={() => record.id && handleDeleteRecord(record.id)}
                        disabled={deleteRecordMutation.isPending}
                        className="p-2 rounded-md transition-colors hover:bg-red-50 disabled:opacity-50"
                        title="削除"
                      >
                        <Trash2 className="h-4 w-4" style={{ color: '#dc2626' }} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
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
