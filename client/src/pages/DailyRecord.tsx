import VehicleLayout from "@/components/VehicleLayout";
import { useLocalData } from "@/hooks/useLocalData";
import { addLocalRecord, formatDateJP, getCycleForDate, LocalRecord, todayJST, updateLocalRecord, deleteLocalRecord } from "@/lib/localDb";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Home, LogIn, LogOut, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";

type DepartureForm = { recordDate: string; departureTime: string; departureDistance: string };
type ArrivalForm = { arrivalTime: string; arrivalDistance: string; jobCount: string };
type EditForm = { recordDate: string; departureTime: string; departureDistance: string; arrivalTime: string; arrivalDistance: string; jobCount: string };

const emptyDeparture = (): DepartureForm => ({ recordDate: todayJST(), departureTime: "", departureDistance: "" });
const emptyArrival = (): ArrivalForm => ({ arrivalTime: "", arrivalDistance: "", jobCount: "" });

function distance(record: LocalRecord) {
  return record.arrivalDistance === null ? null : Math.max(0, record.arrivalDistance - record.departureDistance);
}

export default function DailyRecord() {
  const { data, error, isLoading, refresh } = useLocalData();
  const search = useSearch();
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [departureForm, setDepartureForm] = useState<DepartureForm>(emptyDeparture);
  const [arrivalTarget, setArrivalTarget] = useState<LocalRecord | null>(null);
  const [arrivalForm, setArrivalForm] = useState<ArrivalForm>(emptyArrival);
  const [editing, setEditing] = useState<LocalRecord | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [message, setMessage] = useState("");

  const currentCycle = useMemo(() => getCycleForDate(todayJST()), []);
  const cycles = useMemo(() => {
    const existing = data?.cycles ?? [];
    const withCurrent = existing.some((cycle) => cycle.id === currentCycle.id) ? existing : [currentCycle, ...existing];
    return [...withCurrent].sort((a, b) => b.cycleStartDate.localeCompare(a.cycleStartDate));
  }, [data?.cycles, currentCycle]);
  const activeCycleId = selectedCycleId ?? currentCycle.id;
  const activeIndex = cycles.findIndex((cycle) => cycle.id === activeCycleId);
  const activeCycle = cycles.find((cycle) => cycle.id === activeCycleId) ?? currentCycle;
  const records = useMemo(() => (data?.records ?? []).filter((record) => record.cycleId === activeCycleId), [data?.records, activeCycleId]);
  const totalDistance = records.reduce((sum, record) => sum + (distance(record) ?? 0), 0);

  useEffect(() => {
    if (!data || !new URLSearchParams(search).has("openArrival")) return;
    const target = data.records.filter((record) => record.arrivalTime === null || record.arrivalDistance === null).at(-1);
    if (target) {
      setArrivalTarget(target);
      setArrivalForm(emptyArrival());
    }
  }, [data, search]);

  const saveDeparture = async () => {
    const departureDistance = Number(departureForm.departureDistance);
    if (!departureForm.recordDate || !departureForm.departureTime) return setMessage("記録日と出発時間を入力してください。");
    if (!Number.isFinite(departureDistance) || departureDistance < 0) return setMessage("出発時走行距離を正しく入力してください。");
    await addLocalRecord({ recordDate: departureForm.recordDate, departureTime: departureForm.departureTime, departureDistance, arrivalTime: null, arrivalDistance: null, jobCount: null });
    setDepartureForm(emptyDeparture());
    await refresh();
    setMessage("出発記録を端末に保存しました。帰着後に終了情報を入力してください。");
  };

  const openArrival = (record: LocalRecord) => {
    setEditing(null);
    setEditForm(null);
    setArrivalTarget(record);
    setArrivalForm({ arrivalTime: record.arrivalTime ?? "", arrivalDistance: record.arrivalDistance?.toString() ?? "", jobCount: record.jobCount?.toString() ?? "" });
    window.setTimeout(() => document.getElementById("arrival-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const saveArrival = async () => {
    if (!arrivalTarget) return;
    const arrivalDistance = Number(arrivalForm.arrivalDistance);
    const jobCount = arrivalForm.jobCount.trim() === "" ? null : Number(arrivalForm.jobCount);
    if (!arrivalForm.arrivalTime) return setMessage("終了時間を入力してください。");
    if (!Number.isFinite(arrivalDistance) || arrivalDistance < 0) return setMessage("終了時走行距離を正しく入力してください。");
    if (arrivalDistance < arrivalTarget.departureDistance && !window.confirm("終了時走行距離が出発時走行距離より小さくなっています。保存しますか？")) return;
    if (jobCount !== null && (!Number.isInteger(jobCount) || jobCount < 0)) return setMessage("稼働件数は0以上の整数で入力してください。");
    await updateLocalRecord(arrivalTarget.id, { arrivalTime: arrivalForm.arrivalTime, arrivalDistance, jobCount });
    setArrivalTarget(null);
    setArrivalForm(emptyArrival());
    await refresh();
    setMessage("帰着情報を端末に保存しました。");
  };

  const beginEdit = (record: LocalRecord) => {
    setArrivalTarget(null);
    setEditing(record);
    setEditForm({ recordDate: record.recordDate, departureTime: record.departureTime, departureDistance: String(record.departureDistance), arrivalTime: record.arrivalTime ?? "", arrivalDistance: record.arrivalDistance?.toString() ?? "", jobCount: record.jobCount?.toString() ?? "" });
  };

  const saveEdit = async () => {
    if (!editing || !editForm) return;
    const departureDistance = Number(editForm.departureDistance);
    const arrivalDistance = editForm.arrivalDistance.trim() === "" ? null : Number(editForm.arrivalDistance);
    const jobCount = editForm.jobCount.trim() === "" ? null : Number(editForm.jobCount);
    if (!editForm.recordDate || !editForm.departureTime || !Number.isFinite(departureDistance) || departureDistance < 0) return setMessage("記録日・出発時間・出発時走行距離を正しく入力してください。");
    if (arrivalDistance !== null && (!Number.isFinite(arrivalDistance) || arrivalDistance < 0)) return setMessage("終了時走行距離を正しく入力してください。");
    if (jobCount !== null && (!Number.isInteger(jobCount) || jobCount < 0)) return setMessage("稼働件数は0以上の整数で入力してください。");
    await updateLocalRecord(editing.id, { recordDate: editForm.recordDate, departureTime: editForm.departureTime, departureDistance, arrivalTime: editForm.arrivalTime || null, arrivalDistance, jobCount });
    setEditing(null);
    setEditForm(null);
    await refresh();
    setMessage("記録を端末に保存しました。");
  };

  const removeRecord = async (record: LocalRecord) => {
    if (!window.confirm(`${formatDateJP(record.recordDate)}の記録を削除しますか？`)) return;
    await deleteLocalRecord(record.id);
    await refresh();
    setMessage("記録を削除しました。");
  };

  if (isLoading) return <VehicleLayout title="日次記録"><p className="text-muted-foreground">端末内データを読み込んでいます…</p></VehicleLayout>;

  return (
    <VehicleLayout title="日次記録" subtitle={`${formatDateJP(currentCycle.cycleStartDate)} 〜 ${formatDateJP(currentCycle.cycleEndDate)}`}>
      <div className="mb-5 flex flex-wrap gap-3"><Link href="/" className="btn-secondary flex items-center gap-2"><Home className="h-4 w-4" />ホーム</Link><Link href="/monthly-report" className="btn-secondary flex items-center gap-2"><ArrowLeft className="h-4 w-4" />月次レポート</Link></div>
      {error && <p className="mb-5 rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">{error}</p>}
      {message && <p className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-900">{message}</p>}

      <section className="card-elegant mb-6">
        <label className="mb-2 block text-sm font-medium">対象サイクルを選択</label>
        <select className="input-elegant" value={activeCycleId} onChange={(event) => setSelectedCycleId(event.target.value)}>
          {cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{formatDateJP(cycle.cycleStartDate)} 〜 {formatDateJP(cycle.cycleEndDate)}{cycle.id === currentCycle.id ? "（今月）" : ""}</option>)}
        </select>
        <div className="mt-3 flex items-center gap-3"><button className="btn-secondary flex items-center gap-1" disabled={activeIndex >= cycles.length - 1} onClick={() => setSelectedCycleId(cycles[activeIndex + 1]?.id ?? activeCycleId)}><ChevronLeft className="h-4 w-4" />前のサイクル</button><span className="flex-1 text-center text-sm font-medium text-blue-700">{formatDateJP(activeCycle.cycleStartDate)} 〜 {formatDateJP(activeCycle.cycleEndDate)}</span><button className="btn-secondary flex items-center gap-1" disabled={activeIndex <= 0} onClick={() => setSelectedCycleId(cycles[activeIndex - 1]?.id ?? activeCycleId)}>次のサイクル<ChevronRight className="h-4 w-4" /></button></div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className="card-elegant"><div className="mb-4 flex items-center gap-2"><LogIn className="h-5 w-5 text-blue-700" /><h2 className="text-lg font-semibold">出発記録</h2></div><p className="mb-4 text-sm text-muted-foreground">忘れた日の記録も「記録日」を選んで追加できます。保存先の月次サイクルは日付から自動判定されます。</p><div className="space-y-4"><label className="block text-sm font-medium">記録日<input type="date" className="input-elegant mt-2" value={departureForm.recordDate} onChange={(event) => setDepartureForm({ ...departureForm, recordDate: event.target.value })} /></label><label className="block text-sm font-medium">出発時間 <span className="text-red-500">*</span><input type="time" className="input-elegant mt-2" value={departureForm.departureTime} onChange={(event) => setDepartureForm({ ...departureForm, departureTime: event.target.value })} /></label><label className="block text-sm font-medium">出発時走行距離（km） <span className="text-red-500">*</span><input type="number" step="0.1" min="0" className="input-elegant mt-2" value={departureForm.departureDistance} onChange={(event) => setDepartureForm({ ...departureForm, departureDistance: event.target.value })} placeholder="例: 12345.6" /></label><button onClick={() => void saveDeparture()} className="btn-primary flex w-full items-center justify-center gap-2"><LogIn className="h-5 w-5" />出発記録を保存</button></div></section>

          {arrivalTarget && <section id="arrival-form" className="card-elegant border-2" style={{ borderColor: "#f59e0b" }}><div className="mb-4 flex items-center gap-2"><LogOut className="h-5 w-5 text-amber-600" /><h2 className="text-lg font-semibold text-amber-700">帰着記録</h2></div><div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><p className="font-medium">出発情報（参照）</p><p>{formatDateJP(arrivalTarget.recordDate)}／{arrivalTarget.departureTime}／{arrivalTarget.departureDistance.toFixed(1)} km</p></div><div className="space-y-4"><label className="block text-sm font-medium">終了時間 <span className="text-red-500">*</span><input type="time" className="input-elegant mt-2" value={arrivalForm.arrivalTime} onChange={(event) => setArrivalForm({ ...arrivalForm, arrivalTime: event.target.value })} /></label><label className="block text-sm font-medium">終了時走行距離（km） <span className="text-red-500">*</span><input type="number" step="0.1" min="0" className="input-elegant mt-2" value={arrivalForm.arrivalDistance} onChange={(event) => setArrivalForm({ ...arrivalForm, arrivalDistance: event.target.value })} /></label><label className="block text-sm font-medium">稼働件数（任意）<input type="number" step="1" min="0" inputMode="numeric" className="input-elegant mt-2" value={arrivalForm.jobCount} onChange={(event) => setArrivalForm({ ...arrivalForm, jobCount: event.target.value })} placeholder="例: 8" /></label><div className="grid gap-3 sm:grid-cols-2"><button onClick={() => void saveArrival()} className="btn-primary flex items-center justify-center gap-2"><Check className="h-4 w-4" />帰着情報を保存</button><button onClick={() => { setArrivalTarget(null); setArrivalForm(emptyArrival()); }} className="btn-secondary flex items-center justify-center gap-2"><X className="h-4 w-4" />キャンセル</button></div></div></section>}
        </div>

        <aside className="card-elegant h-fit"><h2 className="text-lg font-semibold">サイクル集計</h2><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between"><dt className="text-muted-foreground">記録日数</dt><dd className="font-bold">{records.length}日</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">総走行距離</dt><dd className="font-bold">{totalDistance.toFixed(1)} km</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">帰着未入力</dt><dd className="font-bold text-amber-700">{records.filter((record) => record.arrivalTime === null || record.arrivalDistance === null).length}件</dd></div></dl></aside>
      </div>

      <section className="card-elegant mt-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">記録一覧</h2><span className="text-sm text-muted-foreground">{records.length}件</span></div>{records.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">このサイクルの記録はまだありません。</p> : <div className="space-y-3">{records.map((record) => { const isEditing = editing?.id === record.id; const driven = distance(record); return <article key={record.id} className="rounded-xl border p-4" style={{ borderColor: record.arrivalTime === null || record.arrivalDistance === null ? "#fbbf24" : "var(--border)", backgroundColor: record.arrivalTime === null || record.arrivalDistance === null ? "#fffbeb" : "var(--card)" }}>{isEditing && editForm ? <div className="space-y-3"><h3 className="font-semibold">記録を編集</h3><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">記録日<input type="date" className="input-elegant mt-1" value={editForm.recordDate} onChange={(event) => setEditForm({ ...editForm, recordDate: event.target.value })} /></label><label className="text-sm font-medium">出発時間<input type="time" className="input-elegant mt-1" value={editForm.departureTime} onChange={(event) => setEditForm({ ...editForm, departureTime: event.target.value })} /></label><label className="text-sm font-medium">出発時走行距離<input type="number" step="0.1" className="input-elegant mt-1" value={editForm.departureDistance} onChange={(event) => setEditForm({ ...editForm, departureDistance: event.target.value })} /></label><label className="text-sm font-medium">終了時間<input type="time" className="input-elegant mt-1" value={editForm.arrivalTime} onChange={(event) => setEditForm({ ...editForm, arrivalTime: event.target.value })} /></label><label className="text-sm font-medium">終了時走行距離<input type="number" step="0.1" className="input-elegant mt-1" value={editForm.arrivalDistance} onChange={(event) => setEditForm({ ...editForm, arrivalDistance: event.target.value })} /></label><label className="text-sm font-medium">稼働件数<input type="number" step="1" min="0" className="input-elegant mt-1" value={editForm.jobCount} onChange={(event) => setEditForm({ ...editForm, jobCount: event.target.value })} /></label></div><div className="grid gap-3 sm:grid-cols-2"><button onClick={() => void saveEdit()} className="btn-primary">保存</button><button onClick={() => { setEditing(null); setEditForm(null); }} className="btn-secondary">キャンセル</button></div></div> : <><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{formatDateJP(record.recordDate)} <span className="ml-2 text-sm font-normal text-muted-foreground">{record.departureTime} 〜 {record.arrivalTime ?? "未入力"}</span></p><p className="mt-1 text-sm text-muted-foreground">{record.departureDistance.toFixed(1)} km → {record.arrivalDistance?.toFixed(1) ?? "—"} km ／ 走行距離: <strong className="text-foreground">{driven === null ? "—" : `${driven.toFixed(1)} km`}</strong>{record.jobCount !== null && <span> ／ 稼働件数: <strong className="text-foreground">{record.jobCount}件</strong></span>}</p></div><div className="flex gap-2">{(record.arrivalTime === null || record.arrivalDistance === null) && <button onClick={() => openArrival(record)} className="btn-primary text-sm"><LogOut className="mr-1 inline h-4 w-4" />帰着</button>}<button onClick={() => beginEdit(record)} className="btn-secondary p-2" aria-label="編集"><Pencil className="h-4 w-4" /></button><button onClick={() => void removeRecord(record)} className="btn-secondary p-2 text-red-700" aria-label="削除"><Trash2 className="h-4 w-4" /></button></div></div></>}</article>; })}</div>}</section>
    </VehicleLayout>
  );
}
