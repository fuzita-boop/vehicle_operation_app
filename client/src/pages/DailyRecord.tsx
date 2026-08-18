import VehicleLayout from "@/components/VehicleLayout";
import { useLocalData } from "@/hooks/useLocalData";
import {
  addLocalRecord,
  currentTimeJST,
  deleteLocalRecord,
  formatDateJP,
  getCycleForDate,
  LocalRecord,
  selectIncompleteArrivalTarget,
  todayJST,
  updateLocalRecord,
} from "@/lib/localDb";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Home,
  LogIn,
  LogOut,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";

type DepartureForm = { recordDate: string; departureTime: string; departureDistance: string };
type ArrivalForm = { arrivalTime: string; arrivalDistance: string; jobCount: string };
type EditForm = DepartureForm & ArrivalForm;

const emptyDeparture = (): DepartureForm => ({ recordDate: todayJST(), departureTime: currentTimeJST(), departureDistance: "" });
const emptyArrival = (): ArrivalForm => ({ arrivalTime: "", arrivalDistance: "", jobCount: "" });
const isIncomplete = (record: LocalRecord) => record.arrivalTime === null || record.arrivalDistance === null;

function distance(record: Pick<LocalRecord, "arrivalDistance" | "departureDistance">) {
  return record.arrivalDistance === null ? null : Math.max(0, record.arrivalDistance - record.departureDistance);
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 text-xs font-medium" style={{ color: "#888" }}>{children}</p>;
}

export function NativePicker({ type, value, onChange, ariaLabel }: { type: "date" | "time"; value: string; onChange: (value: string) => void; ariaLabel: string }) {
  const Icon = type === "date" ? CalendarDays : Clock3;
  const displayValue = type === "date" ? (value ? formatDateJP(value) : "選択してください") : (value || "選択してください");
  return <div className="relative mt-2 h-12 w-full overflow-hidden rounded-lg border border-input bg-background">
    <div className="flex h-full items-center justify-between px-4 text-base font-medium text-foreground" aria-hidden="true">
      <span>{displayValue}</span><Icon className="h-4 w-4 text-muted-foreground" />
    </div>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={ariaLabel}
      className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
    />
  </div>;
}

export default function DailyRecord() {
  const { data, error, isLoading, refresh } = useLocalData();
  const search = useSearch();
  const [, setLocation] = useLocation();
  const arrivalSectionRef = useRef<HTMLElement>(null);
  const autoOpenHandledRef = useRef(false);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [departureForm, setDepartureForm] = useState<DepartureForm>(emptyDeparture);
  const [arrivalTarget, setArrivalTarget] = useState<LocalRecord | null>(null);
  const [arrivalForm, setArrivalForm] = useState<ArrivalForm>(emptyArrival);
  const [editing, setEditing] = useState<LocalRecord | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [message, setMessage] = useState("");

  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const arrivalQuery = searchParams.get("openArrival");
  const openedFromHome = Boolean(arrivalQuery);
  const currentCycle = useMemo(() => getCycleForDate(todayJST()), []);
  const cycles = useMemo(() => {
    const existing = data?.cycles ?? [];
    const withCurrent = existing.some((cycle) => cycle.id === currentCycle.id) ? existing : [currentCycle, ...existing];
    return [...withCurrent].sort((a, b) => b.cycleStartDate.localeCompare(a.cycleStartDate));
  }, [data?.cycles, currentCycle]);
  const activeCycleId = selectedCycleId ?? currentCycle.id;
  const activeIndex = cycles.findIndex((cycle) => cycle.id === activeCycleId);
  const activeCycle = cycles.find((cycle) => cycle.id === activeCycleId) ?? currentCycle;
  const records = useMemo(
    () => [...(data?.records ?? [])]
      .filter((record) => record.cycleId === activeCycleId)
      .sort((a, b) => a.recordDate.localeCompare(b.recordDate) || a.departureTime.localeCompare(b.departureTime)),
    [data?.records, activeCycleId],
  );
  const totalDistance = records.reduce((sum, record) => sum + (distance(record) ?? 0), 0);
  const incompleteCount = records.filter(isIncomplete).length;

  function openArrival(record: LocalRecord) {
    setSelectedCycleId(record.cycleId);
    setEditing(null);
    setEditForm(null);
    setArrivalTarget(record);
    setArrivalForm({
      arrivalTime: record.arrivalTime ?? currentTimeJST(),
      arrivalDistance: record.arrivalDistance?.toString() ?? "",
      jobCount: record.jobCount?.toString() ?? "",
    });
    setMessage("");
  }

  useEffect(() => {
    if (!data || !arrivalQuery || autoOpenHandledRef.current) return;
    autoOpenHandledRef.current = true;
    const selected = selectIncompleteArrivalTarget(data.records, arrivalQuery);
    if (selected) openArrival(selected);
  }, [data, arrivalQuery]);

  useLayoutEffect(() => {
    if (!arrivalTarget) return;

    const scrollToArrivalForm = () => {
      const section = arrivalSectionRef.current;
      if (!section) return;
      const top = window.scrollY + section.getBoundingClientRect().top - 16;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      section.focus({ preventScroll: true });
    };

    const firstFrame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(scrollToArrivalForm);
    });
    const fallbackTimer = window.setTimeout(scrollToArrivalForm, 350);
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.clearTimeout(fallbackTimer);
    };
  }, [arrivalTarget?.id]);

  const saveDeparture = async () => {
    const departureDistance = Number(departureForm.departureDistance);
    if (!departureForm.recordDate || !departureForm.departureTime) {
      setMessage("記録日と出発時間を入力してください。");
      return;
    }
    if (!Number.isFinite(departureDistance) || departureDistance < 0) {
      setMessage("出発時走行距離を正しく入力してください。");
      return;
    }
    await addLocalRecord({
      recordDate: departureForm.recordDate,
      departureTime: departureForm.departureTime,
      departureDistance,
      arrivalTime: null,
      arrivalDistance: null,
      jobCount: null,
    });
    setDepartureForm(emptyDeparture());
    await refresh();
    setMessage("出発記録を端末に保存しました。オレンジ色の「帰着未入力」から、帰着後に入力してください。");
  };

  const saveArrival = async () => {
    if (!arrivalTarget) return;
    const arrivalDistance = Number(arrivalForm.arrivalDistance);
    const jobCount = arrivalForm.jobCount.trim() === "" ? null : Number(arrivalForm.jobCount);
    if (!arrivalForm.arrivalTime) {
      setMessage("終了時間を入力してください。");
      return;
    }
    if (!Number.isFinite(arrivalDistance) || arrivalDistance < 0) {
      setMessage("終了時走行距離を正しく入力してください。");
      return;
    }
    if (arrivalDistance < arrivalTarget.departureDistance && !window.confirm("終了時走行距離が出発時走行距離より小さくなっています。保存しますか？")) return;
    if (jobCount !== null && (!Number.isInteger(jobCount) || jobCount < 0)) {
      setMessage("稼働件数は0以上の整数で入力してください。");
      return;
    }
    await updateLocalRecord(arrivalTarget.id, { arrivalTime: arrivalForm.arrivalTime, arrivalDistance, jobCount });
    setArrivalTarget(null);
    setArrivalForm(emptyArrival());
    await refresh();
    if (openedFromHome) {
      setLocation("/");
      return;
    }
    setMessage("帰着情報を端末に保存しました。");
  };

  const beginEdit = (record: LocalRecord) => {
    setArrivalTarget(null);
    setEditing(record);
    setEditForm({
      recordDate: record.recordDate,
      departureTime: record.departureTime,
      departureDistance: String(record.departureDistance),
      arrivalTime: record.arrivalTime ?? "",
      arrivalDistance: record.arrivalDistance?.toString() ?? "",
      jobCount: record.jobCount?.toString() ?? "",
    });
    setMessage("");
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditForm(null);
  };

  const saveEdit = async () => {
    if (!editing || !editForm) return;
    const departureDistance = Number(editForm.departureDistance);
    const arrivalDistance = editForm.arrivalDistance.trim() === "" ? null : Number(editForm.arrivalDistance);
    const jobCount = editForm.jobCount.trim() === "" ? null : Number(editForm.jobCount);
    if (!editForm.recordDate || !editForm.departureTime || !Number.isFinite(departureDistance) || departureDistance < 0) {
      setMessage("記録日・出発時間・出発時走行距離を正しく入力してください。");
      return;
    }
    if (arrivalDistance !== null && (!Number.isFinite(arrivalDistance) || arrivalDistance < 0)) {
      setMessage("終了時走行距離を正しく入力してください。");
      return;
    }
    if (arrivalDistance !== null && arrivalDistance < departureDistance && !window.confirm("終了時走行距離が出発時走行距離より小さくなっています。保存しますか？")) return;
    if (jobCount !== null && (!Number.isInteger(jobCount) || jobCount < 0)) {
      setMessage("稼働件数は0以上の整数で入力してください。");
      return;
    }
    const updated = await updateLocalRecord(editing.id, {
      recordDate: editForm.recordDate,
      departureTime: editForm.departureTime,
      departureDistance,
      arrivalTime: editForm.arrivalTime || null,
      arrivalDistance,
      jobCount,
    });
    setSelectedCycleId(updated.cycleId);
    setEditing(null);
    setEditForm(null);
    await refresh();
    setMessage("記録を端末に保存しました。");
  };

  const removeRecord = async (record: LocalRecord) => {
    if (!window.confirm(`${formatDateJP(record.recordDate)}の記録を削除しますか？`)) return;
    await deleteLocalRecord(record.id);
    if (arrivalTarget?.id === record.id) {
      setArrivalTarget(null);
      setArrivalForm(emptyArrival());
    }
    await refresh();
    setMessage("記録を削除しました。");
  };

  if (isLoading) return <VehicleLayout title="日次記録"><p className="text-muted-foreground">端末内データを読み込んでいます…</p></VehicleLayout>;

  return (
    <VehicleLayout title="日次記録" subtitle={`${formatDateJP(currentCycle.cycleStartDate)} 〜 ${formatDateJP(currentCycle.cycleEndDate)}`}>
      <div className="mb-5 flex flex-wrap gap-3">
        <Link href="/" className="btn-secondary flex items-center gap-2"><Home className="h-4 w-4" />ホーム</Link>
        <Link href="/monthly-report" className="btn-secondary flex items-center gap-2"><ArrowLeft className="h-4 w-4" />月次レポート</Link>
      </div>
      {error && <p className="mb-5 rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">{error}</p>}
      {message && <p className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-900">{message}</p>}

      <section className="card-elegant mb-6 p-4">
        <p className="mb-3 text-xs font-medium text-muted-foreground">対象サイクルを選択</p>
        <select className="input-elegant mb-3 text-sm" value={activeCycleId} onChange={(event) => setSelectedCycleId(event.target.value)} aria-label="対象サイクルを選択">
          {cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{formatDateJP(cycle.cycleStartDate)} 〜 {formatDateJP(cycle.cycleEndDate)}{cycle.id === currentCycle.id ? "（今月）" : ""}</option>)}
        </select>
        <div className="flex items-center justify-between gap-2">
          <button type="button" className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-40" style={{ backgroundColor: "#f3f4f6", color: "#374151" }} disabled={activeIndex >= cycles.length - 1} onClick={() => setSelectedCycleId(cycles[activeIndex + 1]?.id ?? activeCycleId)}><ChevronLeft className="h-4 w-4" />前のサイクル</button>
          <span className="flex-1 text-center text-sm font-medium" style={{ color: "#1d4ed8" }}>{formatDateJP(activeCycle.cycleStartDate)} 〜 {formatDateJP(activeCycle.cycleEndDate)}{activeCycle.id === currentCycle.id && <span className="ml-2 rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: "#dbeafe", color: "#1d4ed8" }}>今月</span>}</span>
          <button type="button" className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-40" style={{ backgroundColor: "#f3f4f6", color: "#374151" }} disabled={activeIndex <= 0} onClick={() => setSelectedCycleId(cycles[activeIndex - 1]?.id ?? activeCycleId)}>次のサイクル<ChevronRight className="h-4 w-4" /></button>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className="card-elegant">
            <div className="mb-4 flex items-center gap-2"><LogIn className="h-5 w-5 text-blue-700" /><h2 className="text-lg font-semibold">出発記録</h2></div>
            <p className="mb-4 text-sm text-muted-foreground">忘れた日の記録も「記録日」を選んで追加できます。保存先の月次サイクルは日付から自動判定されます。</p>
            <div className="space-y-4">
              <label className="block text-sm font-medium">記録日<NativePicker type="date" value={departureForm.recordDate} onChange={(recordDate) => setDepartureForm({ ...departureForm, recordDate })} ariaLabel="記録日を選択" /></label>
              <label className="block text-sm font-medium">出発時間 <span className="text-red-500">*</span><NativePicker type="time" value={departureForm.departureTime} onChange={(departureTime) => setDepartureForm({ ...departureForm, departureTime })} ariaLabel="出発時間を選択" /></label>
              <label className="block text-sm font-medium">出発時走行距離（km） <span className="text-red-500">*</span><input type="number" step="0.1" min="0" className="input-elegant mt-2" value={departureForm.departureDistance} onChange={(event) => setDepartureForm({ ...departureForm, departureDistance: event.target.value })} placeholder="例: 12345.6" /></label>
              <button type="button" onClick={() => void saveDeparture()} className="btn-primary flex w-full items-center justify-center gap-2"><LogIn className="h-5 w-5" />出発記録を保存</button>
            </div>
          </section>

          {arrivalTarget && <section ref={arrivalSectionRef} id="arrival-form" tabIndex={-1} className="rounded-xl border-2 p-5 shadow-sm" style={{ borderColor: "#f97316", backgroundColor: "#fff7ed" }}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><LogOut className="h-5 w-5 text-orange-600" /><h2 className="text-lg font-semibold text-orange-900">帰着記録を入力</h2></div><span className="rounded-full bg-orange-200 px-3 py-1 text-xs font-bold text-orange-900">帰着入力中</span></div>
            <div className="mb-4 rounded-lg border border-orange-300 bg-white p-3 text-sm text-orange-950"><p className="font-bold">出発情報（参照）</p><p className="mt-1">{formatDateJP(arrivalTarget.recordDate)}／{arrivalTarget.departureTime}／{arrivalTarget.departureDistance.toFixed(1)} km</p></div>
            <div className="space-y-4">
              <label className="block text-sm font-medium">終了時間 <span className="text-red-500">*</span><NativePicker type="time" value={arrivalForm.arrivalTime} onChange={(arrivalTime) => setArrivalForm({ ...arrivalForm, arrivalTime })} ariaLabel="終了時間を選択" /></label>
              <label className="block text-sm font-medium">終了時走行距離（km） <span className="text-red-500">*</span><input type="number" step="0.1" min="0" className="input-elegant mt-2" value={arrivalForm.arrivalDistance} onChange={(event) => setArrivalForm({ ...arrivalForm, arrivalDistance: event.target.value })} /></label>
              <label className="block text-sm font-medium">稼働件数（任意）<input type="number" step="1" min="0" inputMode="numeric" className="input-elegant mt-2" value={arrivalForm.jobCount} onChange={(event) => setArrivalForm({ ...arrivalForm, jobCount: event.target.value })} placeholder="例: 8" /></label>
              <div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => void saveArrival()} className="btn-primary flex items-center justify-center gap-2"><Check className="h-4 w-4" />帰着情報を保存</button><button type="button" onClick={() => { setArrivalTarget(null); setArrivalForm(emptyArrival()); }} className="btn-secondary flex items-center justify-center gap-2"><X className="h-4 w-4" />キャンセル</button></div>
            </div>
          </section>}
        </div>

        <aside className="card-elegant h-fit"><h2 className="text-lg font-semibold">サイクル集計</h2><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between"><dt className="text-muted-foreground">記録日数</dt><dd className="font-bold">{records.length}日</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">総走行距離</dt><dd className="font-bold">{totalDistance.toFixed(1)} km</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">帰着未入力</dt><dd className="font-bold text-orange-700">{incompleteCount}件</dd></div></dl></aside>
      </div>

      <section className="card-elegant mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">記録一覧</h2><span className="text-sm text-muted-foreground">{records.length}件</span></div>
        {records.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">このサイクルの記録はまだありません。</p> : <div className="space-y-3">{records.map((record) => {
          const recordIsIncomplete = isIncomplete(record);
          const isEditing = editing?.id === record.id;
          const isArrivalTarget = arrivalTarget?.id === record.id;
          const driven = distance(record);
          const previewDeparture = editForm ? Number(editForm.departureDistance) : 0;
          const previewArrival = editForm?.arrivalDistance.trim() === "" ? null : Number(editForm?.arrivalDistance);
          const previewDistance = previewArrival === null || !Number.isFinite(previewArrival) || !Number.isFinite(previewDeparture) ? null : Math.max(0, previewArrival - previewDeparture);

          if (isEditing && editForm) {
            return <article key={record.id} className="card-elegant border-2 border-blue-400 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold" style={{ color: "#1d4ed8" }}>記録を編集中</h3><div className="flex gap-2"><button type="button" onClick={() => void saveEdit()} className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ backgroundColor: "#16a34a" }}><Check className="h-4 w-4" />保存</button><button type="button" onClick={cancelEdit} className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ backgroundColor: "#6b7280" }}><X className="h-4 w-4" />取消</button></div></div>
              <div className="grid grid-cols-2 gap-3">
                <label><FieldLabel>記録日</FieldLabel><NativePicker type="date" value={editForm.recordDate} onChange={(recordDate) => setEditForm({ ...editForm, recordDate })} ariaLabel="記録日を選択" /></label>
                <div><FieldLabel>走行距離</FieldLabel><p className="mt-1 text-lg font-bold" style={{ color: "#1d4ed8" }}>{previewDistance === null ? "-" : `${previewDistance.toFixed(1)} km`}</p></div>
                <label><FieldLabel>出発時間 *</FieldLabel><NativePicker type="time" value={editForm.departureTime} onChange={(departureTime) => setEditForm({ ...editForm, departureTime })} ariaLabel="出発時間を選択" /></label>
                <label><FieldLabel>終了時間（任意）</FieldLabel><NativePicker type="time" value={editForm.arrivalTime} onChange={(arrivalTime) => setEditForm({ ...editForm, arrivalTime })} ariaLabel="終了時間を選択" /></label>
                <label><FieldLabel>出発走行距離（km） *</FieldLabel><input type="number" step="0.1" min="0" className="input-elegant text-sm" value={editForm.departureDistance} onChange={(event) => setEditForm({ ...editForm, departureDistance: event.target.value })} /></label>
                <label><FieldLabel>終了走行距離（km）（任意）</FieldLabel><input type="number" step="0.1" min="0" className="input-elegant text-sm" value={editForm.arrivalDistance} onChange={(event) => setEditForm({ ...editForm, arrivalDistance: event.target.value })} placeholder="未入力" /></label>
                <label className="col-span-2"><FieldLabel>稼働件数（任意）</FieldLabel><input type="number" min="0" step="1" className="input-elegant text-sm" value={editForm.jobCount} onChange={(event) => setEditForm({ ...editForm, jobCount: event.target.value })} placeholder="例: 5" /></label>
              </div>
            </article>;
          }

          return <article key={record.id} className="relative rounded-3xl border bg-white px-5 py-5 shadow-sm transition-all" style={isArrivalTarget ? { borderColor: "#fdba74", borderLeft: "5px solid #d97706", backgroundColor: "#fffbeb" } : recordIsIncomplete ? { borderColor: "#fed7aa", borderLeft: "5px solid #f59e0b" } : { borderColor: "#e5e7eb" }}>
            {recordIsIncomplete && <div className="mb-3 flex items-center gap-1"><span className="rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>帰着未入力</span>{isArrivalTarget && <span className="rounded-full px-2 py-1 text-xs font-medium" style={{ backgroundColor: "#fed7aa", color: "#9a3412" }}>帰着入力中</span>}</div>}
            <div className="grid grid-cols-3 gap-x-2 gap-y-4">
              <div className="min-w-0"><FieldLabel>日付</FieldLabel><p className="whitespace-nowrap text-[15px] font-semibold leading-tight sm:text-lg" style={{ color: "#111" }}>{formatDateJP(record.recordDate)}</p></div>
              <div className="min-w-0"><FieldLabel>出発</FieldLabel><p className="whitespace-nowrap text-[15px] font-semibold leading-tight sm:text-lg" style={{ color: "#111" }}>{record.departureTime}</p></div>
              <div className="min-w-0"><FieldLabel>終了</FieldLabel><p className="whitespace-nowrap text-[15px] font-semibold leading-tight sm:text-lg" style={{ color: recordIsIncomplete ? "#d97706" : "#111" }}>{record.arrivalTime ?? "未入力"}</p></div>
              <div className="min-w-0"><FieldLabel>出発距離</FieldLabel><p className="whitespace-nowrap text-[15px] font-semibold leading-tight sm:text-lg" style={{ color: "#111" }}>{record.departureDistance.toFixed(1)}</p></div>
              <div className="min-w-0"><FieldLabel>終了距離</FieldLabel><p className="whitespace-nowrap text-[15px] font-semibold leading-tight sm:text-lg" style={{ color: recordIsIncomplete ? "#d97706" : "#111" }}>{record.arrivalDistance?.toFixed(1) ?? "-"}</p></div>
              <div className="min-w-0"><FieldLabel>走行距離</FieldLabel><p className="whitespace-nowrap text-[15px] font-bold leading-tight sm:text-lg" style={{ color: recordIsIncomplete ? "#d97706" : "#2563eb" }}>{driven === null ? "-" : `${driven.toFixed(1)} km`}</p></div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3" style={{ borderColor: recordIsIncomplete ? "#fed7aa" : "#f1f5f9" }}>
              <p className="text-xs" style={{ color: "#6b7280" }}>稼働件数：<strong style={{ color: "#374151" }}>{record.jobCount ?? "-"}件</strong></p>
              <div className="flex items-center gap-1">
                {recordIsIncomplete && <button type="button" onClick={() => openArrival(record)} className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-bold text-white shadow-sm" style={{ backgroundColor: isArrivalTarget ? "#b45309" : "#d97706" }} title="帰着情報を入力"><LogOut className="h-4 w-4" />帰着</button>}
                <button type="button" onClick={() => beginEdit(record)} className="rounded-xl p-2 transition-colors hover:bg-blue-50" title="編集" aria-label="編集"><Pencil className="h-5 w-5" style={{ color: "#2563eb" }} /></button>
                <button type="button" onClick={() => void removeRecord(record)} className="rounded-xl p-2 transition-colors hover:bg-red-50" title="削除" aria-label="削除"><Trash2 className="h-5 w-5" style={{ color: "#dc2626" }} /></button>
              </div>
            </div>
            {recordIsIncomplete && <p className="mt-3 flex items-center gap-1 text-sm font-medium text-orange-800"><AlertTriangle className="h-4 w-4" />帰着後に「帰着」ボタンから終了情報を入力してください。</p>}
          </article>;
        })}</div>}
      </section>
    </VehicleLayout>
  );
}
