import VehicleLayout from "@/components/VehicleLayout";
import { useLocalData } from "@/hooks/useLocalData";
import { formatDateJP, getCycleForDate, LocalRecord, todayJST } from "@/lib/localDb";
import { ChevronLeft, ChevronRight, Download, Home, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

function distance(record: LocalRecord) {
  return record.arrivalDistance === null ? 0 : Math.max(0, record.arrivalDistance - record.departureDistance);
}

export default function MonthlyReport() {
  const { data, error, isLoading } = useLocalData();
  const currentCycle = useMemo(() => getCycleForDate(todayJST()), []);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const cycles = useMemo(() => {
    const available = data?.cycles ?? [];
    const withCurrent = available.some((cycle) => cycle.id === currentCycle.id) ? available : [currentCycle, ...available];
    return [...withCurrent].sort((a, b) => b.cycleStartDate.localeCompare(a.cycleStartDate));
  }, [data?.cycles, currentCycle]);
  const activeCycleId = selectedCycleId ?? currentCycle.id;
  const activeCycle = cycles.find((cycle) => cycle.id === activeCycleId) ?? currentCycle;
  const activeIndex = cycles.findIndex((cycle) => cycle.id === activeCycle.id);
  const records = useMemo(() => (data?.records ?? []).filter((record) => record.cycleId === activeCycle.id), [data?.records, activeCycle.id]);
  const totalDistance = records.reduce((sum, record) => sum + distance(record), 0);
  const totalJobs = records.reduce((sum, record) => sum + (record.jobCount ?? 0), 0);
  const printReport = () => window.print();

  if (isLoading) return <VehicleLayout title="月次レポート"><p className="text-muted-foreground">端末内データを読み込んでいます…</p></VehicleLayout>;

  return (
    <VehicleLayout title="月次レポート" subtitle="端末内に保存された1ヶ月分の運行記録">
      <div className="no-print mb-5 flex flex-wrap gap-3"><Link href="/" className="btn-secondary flex items-center gap-2"><Home className="h-4 w-4" />ホーム</Link><Link href="/daily-record" className="btn-secondary">日次記録</Link></div>
      {error && <p className="no-print mb-5 rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">{error}</p>}

      <section className="no-print card-elegant mb-6">
        <label className="mb-2 block text-sm font-medium">対象サイクルを選択</label>
        <select className="input-elegant" value={activeCycle.id} onChange={(event) => setSelectedCycleId(event.target.value)}>
          {cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{formatDateJP(cycle.cycleStartDate)} 〜 {formatDateJP(cycle.cycleEndDate)}{cycle.id === currentCycle.id ? "（今月）" : ""}</option>)}
        </select>
        <div className="mt-3 flex items-center gap-3"><button className="btn-secondary flex items-center gap-1" disabled={activeIndex >= cycles.length - 1} onClick={() => setSelectedCycleId(cycles[activeIndex + 1]?.id ?? activeCycle.id)}><ChevronLeft className="h-4 w-4" />前のサイクル</button><span className="flex-1 text-center text-sm font-medium text-blue-700">{formatDateJP(activeCycle.cycleStartDate)} 〜 {formatDateJP(activeCycle.cycleEndDate)}</span><button className="btn-secondary flex items-center gap-1" disabled={activeIndex <= 0} onClick={() => setSelectedCycleId(cycles[activeIndex - 1]?.id ?? activeCycle.id)}>次のサイクル<ChevronRight className="h-4 w-4" /></button></div>
      </section>

      <article className="print-container card-elegant">
        <h1 className="mb-1 text-center text-2xl font-bold text-foreground underline underline-offset-4">車両運行日報</h1>
        <div className="mb-3 mt-4 grid grid-cols-2 gap-3 text-sm"><p>運転者名：<strong>{data?.profile.driverName || "未設定"}</strong></p><p>車両番号：<strong>{data?.profile.vehicleNumber || "未設定"}</strong></p></div>
        <p className="mb-3 rounded bg-muted py-2 text-center text-sm">対象期間：{formatDateJP(activeCycle.cycleStartDate)} 〜 {formatDateJP(activeCycle.cycleEndDate)}</p>
        <div className="overflow-x-auto"><table className="print-table table-elegant text-sm"><thead><tr><th>日付</th><th>出発<br />時間</th><th>終了<br />時間</th><th>出発時<br />距離</th><th>終了時<br />距離</th><th>走行<br />距離</th><th>稼働<br />件数</th></tr></thead><tbody>{records.length === 0 ? <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">この期間の記録はありません。</td></tr> : records.map((record) => <tr key={record.id}><td>{formatDateJP(record.recordDate)}</td><td>{record.departureTime}</td><td>{record.arrivalTime ?? "—"}</td><td>{record.departureDistance.toFixed(1)}</td><td>{record.arrivalDistance?.toFixed(1) ?? "—"}</td><td className="font-semibold">{record.arrivalDistance === null ? "—" : distance(record).toFixed(1)}</td><td>{record.jobCount ?? "—"}</td></tr>)}</tbody></table></div>
        <div className="mt-4 flex flex-wrap justify-end gap-x-8 gap-y-2 border-t-2 border-black pt-3 text-lg font-semibold"><p>記録日数：{records.length}日</p><p>総走行距離：{totalDistance.toFixed(1)} km</p><p>総稼働件数：{totalJobs}件</p></div>
        <section className="mt-4 border-t border-black pt-3 text-sm"><p className="font-semibold">ガソリン代計算欄 <span className="font-normal">（給与計算担当者記載）</span></p><p className="mt-2">単価（　　　円） × 総距離数（{totalDistance.toFixed(1)} km） ＝ 合計（　　　　　　円）</p></section>
        <p className="mt-4 text-right text-xs text-muted-foreground">印刷日：{formatDateJP(todayJST())}</p>
      </article>

      <div className="no-print mt-6 grid gap-3 sm:grid-cols-2"><button onClick={printReport} className="btn-primary flex items-center justify-center gap-2 py-3"><Printer className="h-5 w-5" />印刷</button><button onClick={printReport} className="btn-secondary flex items-center justify-center gap-2 py-3"><Download className="h-5 w-5" />PDFに保存</button></div>
      <p className="no-print mt-3 text-center text-sm text-muted-foreground">「PDFに保存」は印刷画面で保存先を「PDFに保存」に選択してください。印刷とPDFは同じA4レイアウトです。</p>
    </VehicleLayout>
  );
}
