import { useState, useEffect } from "react";
import VehicleLayout from "@/components/VehicleLayout";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ArrowLeft, Plus, Pencil, Trash2, Check, X, LogIn, LogOut } from "lucide-react";

/** Convert any date value to YYYY-MM-DD string in local timezone */
function toDateString(val: string | Date | unknown): string {
  if (!val) return new Date().toISOString().split('T')[0];
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(val);
  // If already YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // If ISO string like "2026-02-28T15:00:00.000Z"
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return str;
}

interface DailyRecordData {
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

/** 出発フォームの状態 */
interface DepartureForm {
  recordDate: string;
  departureTime: string;
  departureDistance: string;
}

/** 帰着フォームの状態（編集用） */
interface ArrivalEditForm {
  arrivalTime: string;
  arrivalDistance: string;
}

export default function DailyRecord() {
  const [departureForm, setDepartureForm] = useState<DepartureForm>({
    recordDate: new Date().toISOString().split("T")[0],
    departureTime: "",
    departureDistance: "",
  });

  const [records, setRecords] = useState<DailyRecordData[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<DailyRecordData | null>(null);
  // 帰着情報追加モード（記録IDをキーにして管理）
  const [arrivalEditId, setArrivalEditId] = useState<number | null>(null);
  const [arrivalEditForm, setArrivalEditForm] = useState<ArrivalEditForm>({ arrivalTime: "", arrivalDistance: "" });

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
        recordDate: toDateString(r.recordDate),
        departureDistance: typeof r.departureDistance === 'string' ? parseFloat(r.departureDistance) : r.departureDistance,
        arrivalDistance: r.arrivalDistance == null
          ? null
          : typeof r.arrivalDistance === 'string'
            ? parseFloat(r.arrivalDistance)
            : r.arrivalDistance,
        arrivalTime: r.arrivalTime ?? null,
      })));
    }
  }, [initialRecords, currentCycle?.id]);

  const calculateDistance = (departure: number, arrival: number | null) => {
    if (arrival == null) return null;
    return Math.max(0, arrival - departure);
  };

  const totalDistance = records.reduce((sum, record) => {
    const depDist = typeof record.departureDistance === 'string' ? parseFloat(record.departureDistance) : record.departureDistance as number;
    const arrDist = record.arrivalDistance == null
      ? null
      : typeof record.arrivalDistance === 'string'
        ? parseFloat(record.arrivalDistance)
        : record.arrivalDistance as number;
    const d = calculateDistance(depDist, arrDist);
    return sum + (d ?? 0);
  }, 0);

  /** 出発時のみ保存 */
  const handleDeparture = async () => {
    const depDist = parseFloat(departureForm.departureDistance);

    if (!departureForm.departureTime) {
      alert("出発時間を入力してください");
      return;
    }
    if (isNaN(depDist) || depDist < 0) {
      alert("出発時走行距離を正しく入力してください");
      return;
    }
    if (!currentCycle?.id) {
      alert("サイクル情報が見つかりません");
      return;
    }

    try {
      await addRecordMutation.mutateAsync({
        cycleId: currentCycle.id,
        recordDate: departureForm.recordDate,
        departureTime: departureForm.departureTime,
        arrivalTime: null,
        departureDistance: depDist,
        arrivalDistance: null,
      });

      setDepartureForm({
        recordDate: new Date().toISOString().split("T")[0],
        departureTime: "",
        departureDistance: "",
      });

      await refetch();
      alert("出発記録を保存しました。帰着後に終了情報を追加してください。");
    } catch (error) {
      console.error("Failed to add departure record:", error);
      alert("記録の保存に失敗しました: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  /** 帰着情報の追加保存 */
  const handleSaveArrival = async () => {
    if (!arrivalEditId) return;
    const arrDist = parseFloat(arrivalEditForm.arrivalDistance);
    const record = records.find(r => r.id === arrivalEditId);

    if (!arrivalEditForm.arrivalTime) {
      alert("終了時間を入力してください");
      return;
    }
    if (isNaN(arrDist) || arrDist < 0) {
      alert("終了時走行距離を正しく入力してください");
      return;
    }
    if (record) {
      const depDist = typeof record.departureDistance === 'string' ? parseFloat(record.departureDistance) : record.departureDistance as number;
      if (arrDist < depDist) {
        if (!confirm(`終了走行距離(${arrDist})が出発走行距離(${depDist})より小さいですが、保存しますか？`)) return;
      }
    }

    try {
      await updateRecordMutation.mutateAsync({
        recordId: arrivalEditId,
        arrivalTime: arrivalEditForm.arrivalTime,
        arrivalDistance: arrDist,
      });
      setArrivalEditId(null);
      setArrivalEditForm({ arrivalTime: "", arrivalDistance: "" });
      await refetch();
      alert("帰着情報を保存しました");
    } catch (error) {
      console.error("Failed to save arrival:", error);
      alert("帰着情報の保存に失敗しました: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleStartEdit = (record: DailyRecordData) => {
    if (!record.id) return;
    setEditingId(record.id);
    const dateStr = toDateString(record.recordDate);
    setEditForm({
      ...record,
      recordDate: dateStr,
      departureDistance: typeof record.departureDistance === 'string' ? parseFloat(record.departureDistance) : record.departureDistance,
      arrivalDistance: record.arrivalDistance == null
        ? null
        : typeof record.arrivalDistance === 'string'
          ? parseFloat(record.arrivalDistance)
          : record.arrivalDistance,
      arrivalTime: record.arrivalTime ?? null,
    });
    // 帰着追加モードを閉じる
    setArrivalEditId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleSaveEdit = async () => {
    if (!editForm || !editingId) return;

    const depDistEdit = typeof editForm.departureDistance === 'string' ? parseFloat(editForm.departureDistance as string) : editForm.departureDistance as number;
    const arrDistEdit = editForm.arrivalDistance == null
      ? null
      : typeof editForm.arrivalDistance === 'string'
        ? parseFloat(editForm.arrivalDistance as string)
        : editForm.arrivalDistance as number;

    if (!editForm.departureTime) {
      alert("出発時間を入力してください");
      return;
    }
    if (isNaN(depDistEdit) || depDistEdit < 0) {
      alert("出発走行距離を正しく入力してください");
      return;
    }
    if (editForm.arrivalTime && (arrDistEdit == null || isNaN(arrDistEdit))) {
      alert("終了時間を入力した場合は終了走行距離も入力してください");
      return;
    }

    try {
      const recordDateStr = toDateString(editForm.recordDate);
      await updateRecordMutation.mutateAsync({
        recordId: editingId,
        recordDate: recordDateStr,
        departureTime: editForm.departureTime,
        arrivalTime: editForm.arrivalTime ?? undefined,
        departureDistance: depDistEdit,
        arrivalDistance: arrDistEdit ?? undefined,
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

  const incompleteCount = records.filter(r => r.arrivalTime == null).length;

  return (
    <VehicleLayout title="日次記録入力" subtitle="毎日の運行記録を入力してください">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 出発記録フォーム */}
        <div className="lg:col-span-2">
          <div className="card-elegant">
            <div className="flex items-center gap-2 mb-6">
              <LogIn className="h-5 w-5" style={{ color: '#1d4ed8' }} />
              <h2 className="text-lg font-semibold text-foreground">出発記録</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">出発時間と走行距離を入力して保存してください。帰着後に終了情報を追加できます。</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">記録日</label>
                <input
                  type="date"
                  value={departureForm.recordDate}
                  onChange={(e) => setDepartureForm({ ...departureForm, recordDate: e.target.value })}
                  className="input-elegant"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">出発時間 <span className="text-red-500">*</span></label>
                <input
                  type="time"
                  value={departureForm.departureTime}
                  onChange={(e) => setDepartureForm({ ...departureForm, departureTime: e.target.value })}
                  className="input-elegant"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">出発時走行距離 (km) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={departureForm.departureDistance}
                  placeholder="例: 12345.6"
                  onChange={(e) => setDepartureForm({ ...departureForm, departureDistance: e.target.value })}
                  className="input-elegant"
                />
              </div>

              <button
                onClick={handleDeparture}
                disabled={addRecordMutation.isPending}
                className="w-full mt-4 px-4 py-3 font-bold text-lg rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-white"
                style={{ backgroundColor: '#1d4ed8' }}
              >
                <LogIn className="h-5 w-5" />
                {addRecordMutation.isPending ? "保存中..." : "出発記録を保存"}
              </button>
            </div>
          </div>
        </div>

        {/* サマリーカード */}
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
            {incompleteCount > 0 && (
              <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b' }}>
                <p className="text-sm font-medium" style={{ color: '#92400e' }}>
                  ⚠ 帰着未入力: {incompleteCount}件
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 記録一覧 */}
      {records.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">記録一覧</h3>
          <div className="space-y-3">
            {records.map((record, idx) => {
              const rDepDist = typeof record.departureDistance === 'string' ? parseFloat(record.departureDistance) : record.departureDistance as number;
              const rArrDist = record.arrivalDistance == null
                ? null
                : typeof record.arrivalDistance === 'string'
                  ? parseFloat(record.arrivalDistance)
                  : record.arrivalDistance as number;
              const distance = calculateDistance(rDepDist, rArrDist);
              const isIncomplete = record.arrivalTime == null;
              const isEditing = editingId === record.id;
              const isAddingArrival = arrivalEditId === record.id;

              // 全体編集モード
              if (isEditing && editForm) {
                const eDepDist = typeof editForm.departureDistance === 'string' ? parseFloat(editForm.departureDistance as string) : editForm.departureDistance as number;
                const eArrDist = editForm.arrivalDistance == null
                  ? null
                  : typeof editForm.arrivalDistance === 'string'
                    ? parseFloat(editForm.arrivalDistance as string)
                    : editForm.arrivalDistance as number;
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
                          value={toDateString(editForm.recordDate)}
                          onChange={(e) => {
                            const newDate = e.target.value;
                            setEditForm(prev => prev ? { ...prev, recordDate: newDate } : prev);
                          }}
                          className="input-elegant text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: '#555' }}>走行距離</label>
                        <p className="text-lg font-bold mt-1" style={{ color: '#1d4ed8' }}>
                          {editDistance != null ? `${editDistance.toFixed(1)} km` : '-'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: '#555' }}>出発時間 *</label>
                        <input
                          type="time"
                          value={editForm.departureTime}
                          onChange={(e) => setEditForm({ ...editForm, departureTime: e.target.value })}
                          className="input-elegant text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: '#555' }}>終了時間（任意）</label>
                        <input
                          type="time"
                          value={editForm.arrivalTime ?? ""}
                          onChange={(e) => setEditForm({ ...editForm, arrivalTime: e.target.value || null })}
                          className="input-elegant text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: '#555' }}>出発走行距離 (km) *</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
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
                        <label className="block text-xs font-medium mb-1" style={{ color: '#555' }}>終了走行距離 (km)（任意）</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={eArrDist == null ? "" : eArrDist === 0 ? "" : eArrDist}
                          placeholder="未入力"
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              arrivalDistance: e.target.value === "" ? null : parseFloat(e.target.value) || 0,
                            })
                          }
                          className="input-elegant text-sm"
                        />
                      </div>
                    </div>
                  </div>
                );
              }

              // 帰着情報追加モード
              if (isAddingArrival) {
                return (
                  <div key={record.id || idx} className="card-elegant border-2 p-4" style={{ borderColor: '#f59e0b' }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <LogOut className="h-4 w-4" style={{ color: '#d97706' }} />
                        <h4 className="font-semibold" style={{ color: '#d97706' }}>帰着情報を入力</h4>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveArrival}
                          disabled={updateRecordMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium text-white transition-colors disabled:opacity-50"
                          style={{ backgroundColor: '#d97706' }}
                        >
                          <Check className="h-4 w-4" />
                          {updateRecordMutation.isPending ? "保存中..." : "帰着保存"}
                        </button>
                        <button
                          onClick={() => { setArrivalEditId(null); setArrivalEditForm({ arrivalTime: "", arrivalDistance: "" }); }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium text-white transition-colors"
                          style={{ backgroundColor: '#6b7280' }}
                        >
                          <X className="h-4 w-4" />
                          取消
                        </button>
                      </div>
                    </div>
                    <div className="text-sm mb-3" style={{ color: '#555' }}>
                      出発: {new Date(record.recordDate).toLocaleDateString("ja-JP")} {record.departureTime}
                      　出発距離: {rDepDist.toFixed(1)} km
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: '#555' }}>終了時間 *</label>
                        <input
                          type="time"
                          value={arrivalEditForm.arrivalTime}
                          onChange={(e) => setArrivalEditForm({ ...arrivalEditForm, arrivalTime: e.target.value })}
                          className="input-elegant text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: '#555' }}>終了走行距離 (km) *</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={arrivalEditForm.arrivalDistance}
                          placeholder="例: 12400.0"
                          onChange={(e) => setArrivalEditForm({ ...arrivalEditForm, arrivalDistance: e.target.value })}
                          className="input-elegant text-sm"
                        />
                      </div>
                    </div>
                  </div>
                );
              }

              // 通常表示
              return (
                <div
                  key={record.id || idx}
                  className="card-elegant p-4"
                  style={isIncomplete ? { borderLeft: '4px solid #f59e0b' } : {}}
                >
                  {isIncomplete && (
                    <div className="flex items-center gap-1 mb-2">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                        帰着未入力
                      </span>
                    </div>
                  )}
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
                        <p className="font-medium" style={{ color: isIncomplete ? '#f59e0b' : '#111' }}>
                          {record.arrivalTime ?? '未入力'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: '#888' }}>出発距離</p>
                        <p className="font-medium" style={{ color: '#111' }}>{rDepDist.toFixed(1)}</p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: '#888' }}>終了距離</p>
                        <p className="font-medium" style={{ color: isIncomplete ? '#f59e0b' : '#111' }}>
                          {rArrDist != null ? rArrDist.toFixed(1) : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: '#888' }}>走行距離</p>
                        <p className="font-bold" style={{ color: isIncomplete ? '#f59e0b' : '#1d4ed8' }}>
                          {distance != null ? `${distance.toFixed(1)} km` : '-'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 ml-3 shrink-0">
                      {isIncomplete && (
                        <button
                          onClick={() => {
                            if (!record.id) return;
                            setArrivalEditId(record.id);
                            setArrivalEditForm({ arrivalTime: "", arrivalDistance: "" });
                            setEditingId(null);
                          }}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium text-white transition-colors"
                          style={{ backgroundColor: '#d97706' }}
                          title="帰着情報を入力"
                        >
                          <LogOut className="h-3 w-3" />
                          帰着
                        </button>
                      )}
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

      {/* ナビゲーション */}
      <div className="mt-8 flex gap-4">
        <Link href="/" className="btn-secondary flex items-center gap-2">
          <ArrowLeft className="h-5 w-5" />
          ホームに戻る
        </Link>
      </div>
    </VehicleLayout>
  );
}
