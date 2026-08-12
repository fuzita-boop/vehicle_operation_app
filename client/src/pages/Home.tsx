import VehicleLayout from "@/components/VehicleLayout";
import { useLocalData } from "@/hooks/useLocalData";
import { exportLocalBackup, formatDateJP, getCycleForDate, importLocalBackup, saveProfile, todayJST } from "@/lib/localDb";
import { AlertTriangle, Calendar, Download, FileText, HardDrive, Plus, Upload } from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";

export default function Home() {
  const { data, error, isLoading, refresh } = useLocalData();
  const [driverName, setDriverName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [editingDriver, setEditingDriver] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(false);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!data) return;
    setDriverName(data.profile.driverName);
    setVehicleNumber(data.profile.vehicleNumber);
  }, [data]);

  const cycle = useMemo(() => getCycleForDate(todayJST()), []);
  const incompleteRecords = useMemo(
    () => (data?.records ?? []).filter((record) => record.cycleId === cycle.id && (record.arrivalTime === null || record.arrivalDistance === null)),
    [data?.records, cycle.id],
  );
  const incompleteCount = incompleteRecords.length;
  const latestIncomplete = incompleteRecords.at(-1);
  const arrivalHref = latestIncomplete ? `/daily-record?openArrival=${encodeURIComponent(latestIncomplete.id)}` : "/daily-record";

  const saveDriver = async () => {
    await saveProfile({ driverName: driverName.trim(), vehicleNumber: data?.profile.vehicleNumber ?? "" });
    setEditingDriver(false);
    setMessage("運転者名を端末に保存しました。");
  };

  const saveVehicle = async () => {
    await saveProfile({ driverName: data?.profile.driverName ?? "", vehicleNumber: vehicleNumber.trim() });
    setEditingVehicle(false);
    setMessage("車両番号を端末に保存しました。");
  };

  const downloadBackup = async () => {
    const backup = await exportLocalBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `車両運行日報_バックアップ_${todayJST()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("バックアップJSONをダウンロードしました。安全な場所に保管してください。");
  };

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const content = JSON.parse(await file.text());
      if (importMode === "replace" && !window.confirm("端末内の現在のデータをすべて置き換えます。続けますか？")) return;
      await importLocalBackup(content, importMode);
      await refresh();
      setMessage(importMode === "replace" ? "バックアップで端末内のデータを置き換えました。" : "バックアップを端末内データへ統合しました。");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "バックアップの復元に失敗しました。");
    } finally {
      event.target.value = "";
    }
  };

  if (isLoading) {
    return <VehicleLayout title="車両運行日報"><p className="text-muted-foreground">端末内データを読み込んでいます…</p></VehicleLayout>;
  }

  return (
    <VehicleLayout title="車両運行日報" subtitle={`現在のサイクル: ${formatDateJP(cycle.cycleStartDate)} 〜 ${formatDateJP(cycle.cycleEndDate)}`}>
      {error && <p className="mb-5 rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">{error}</p>}
      {message && <p className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-900">{message}</p>}

      {incompleteCount > 0 && (
        <Link href={arrivalHref} className="mb-6 flex items-center gap-3 rounded-xl border-2 px-5 py-4 shadow-sm" style={{ backgroundColor: "#fff7ed", borderColor: "#f97316", textDecoration: "none" }}>
          <AlertTriangle className="h-6 w-6 shrink-0" style={{ color: "#ea580c" }} />
          <div className="flex-1">
            <p className="font-bold" style={{ color: "#9a3412" }}>帰着未入力の記録が {incompleteCount} 件あります</p>
            <p className="mt-0.5 text-sm" style={{ color: "#c2410c" }}>ここをタップして帰着情報を入力してください</p>
          </div>
          <span className="text-2xl" style={{ color: "#ea580c" }}>›</span>
        </Link>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <section className="card-elegant">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">運転者情報</h2><button onClick={() => setEditingDriver(!editingDriver)} className="btn-secondary text-sm">{editingDriver ? "閉じる" : "編集"}</button></div>
          {editingDriver ? <div className="space-y-3"><input value={driverName} onChange={(event) => setDriverName(event.target.value)} placeholder="運転者名を入力" className="input-elegant" /><button onClick={() => void saveDriver()} className="btn-primary w-full">保存</button></div> : <p className="py-4 text-center text-2xl font-bold">{driverName || <span className="text-muted-foreground">未設定</span>}</p>}
        </section>

        <section className="card-elegant">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">車両情報</h2><button onClick={() => setEditingVehicle(!editingVehicle)} className="btn-secondary text-sm">{editingVehicle ? "閉じる" : "編集"}</button></div>
          {editingVehicle ? <div className="space-y-3"><input value={vehicleNumber} onChange={(event) => setVehicleNumber(event.target.value)} placeholder="車両番号を入力" className="input-elegant" /><button onClick={() => void saveVehicle()} className="btn-primary w-full">保存</button></div> : <p className="py-4 text-center text-2xl font-bold">{vehicleNumber || <span className="text-muted-foreground">未設定</span>}</p>}
        </section>

        <section className="card-elegant"><div className="mb-4 flex items-center gap-2"><Calendar className="h-5 w-5 text-accent" /><h2 className="text-lg font-semibold">現在のサイクル</h2></div><div className="space-y-2 text-sm text-muted-foreground"><p>開始: <strong className="text-foreground">{formatDateJP(cycle.cycleStartDate)}</strong></p><p>終了: <strong className="text-foreground">{formatDateJP(cycle.cycleEndDate)}</strong></p></div></section>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Link href={arrivalHref} className="rounded-xl py-8 text-center shadow-sm" style={{ backgroundColor: incompleteCount ? "#fff7ed" : "var(--card)", border: incompleteCount ? "2px solid #f97316" : "1px solid var(--border)", textDecoration: "none" }}>
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: incompleteCount ? "#fed7aa" : "#1d4ed8" }}><Plus className="h-9 w-9 text-white" /></div>
          <h3 className="text-lg font-semibold text-foreground">本日の記録を入力</h3><p className="mt-1 text-sm text-muted-foreground">出発・帰着・稼働件数を記録</p>
        </Link>
        <Link href="/monthly-report" className="card-elegant py-8 text-center"><div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-600"><FileText className="h-9 w-9 text-white" /></div><h3 className="text-lg font-semibold">月次レポート</h3><p className="mt-1 text-sm text-muted-foreground">1ヶ月分の記録を表示・印刷</p></Link>
      </div>

      <section className="card-elegant mt-8">
        <div className="mb-2 flex items-center gap-2"><HardDrive className="h-5 w-5 text-blue-700" /><h2 className="text-lg font-semibold">データのバックアップと復元</h2></div>
        <p className="mb-4 text-sm text-muted-foreground">このアプリのデータは端末内にのみ保存されます。機種変更・ブラウザのデータ削除前には必ずバックアップしてください。</p>
        <div className="grid gap-3 md:grid-cols-3">
          <button onClick={() => void downloadBackup()} className="btn-primary flex items-center justify-center gap-2"><Download className="h-4 w-4" />バックアップを保存</button>
          <select aria-label="復元方法" className="input-elegant" value={importMode} onChange={(event) => setImportMode(event.target.value as "merge" | "replace")}><option value="merge">復元：現在のデータと統合</option><option value="replace">復元：現在のデータを置換</option></select>
          <button onClick={() => inputRef.current?.click()} className="btn-secondary flex items-center justify-center gap-2"><Upload className="h-4 w-4" />バックアップを復元</button>
          <input ref={inputRef} type="file" accept="application/json,.json" onChange={(event) => void importBackup(event)} className="hidden" />
        </div>
      </section>
    </VehicleLayout>
  );
}
