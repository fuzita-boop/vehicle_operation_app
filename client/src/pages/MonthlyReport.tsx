import VehicleLayout from "@/components/VehicleLayout";
import { useLocalData } from "@/hooks/useLocalData";
import { formatDateJP, getCycleForDate, LocalRecord, todayJST } from "@/lib/localDb";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

function calculateDistance(record: LocalRecord) {
  return record.arrivalDistance === null
    ? 0
    : Math.max(0, record.arrivalDistance - record.departureDistance);
}

export default function MonthlyReport() {
  const { data, error, isLoading } = useLocalData();
  const currentCycle = useMemo(() => getCycleForDate(todayJST()), []);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);

  const cycles = useMemo(() => {
    const available = data?.cycles ?? [];
    const withCurrent = available.some((cycle) => cycle.id === currentCycle.id)
      ? available
      : [currentCycle, ...available];
    return [...withCurrent].sort((a, b) => b.cycleStartDate.localeCompare(a.cycleStartDate));
  }, [data?.cycles, currentCycle]);

  const activeCycleId = selectedCycleId ?? currentCycle.id;
  const activeCycle = cycles.find((cycle) => cycle.id === activeCycleId) ?? currentCycle;
  const activeIndex = cycles.findIndex((cycle) => cycle.id === activeCycle.id);
  const records = useMemo(
    () => [...(data?.records ?? [])]
      .filter((record) => record.cycleId === activeCycle.id)
      .sort((a, b) => a.recordDate.localeCompare(b.recordDate) || a.departureTime.localeCompare(b.departureTime)),
    [data?.records, activeCycle.id],
  );
  const totalDistance = records.reduce((sum, record) => sum + calculateDistance(record), 0);
  const driverName = data?.profile.driverName || "-";
  const vehicleNumber = data?.profile.vehicleNumber || "-";

  const goToPreviousCycle = () => {
    if (activeIndex < cycles.length - 1) setSelectedCycleId(cycles[activeIndex + 1].id);
  };

  const goToNextCycle = () => {
    if (activeIndex > 0) setSelectedCycleId(cycles[activeIndex - 1].id);
  };

  if (isLoading) {
    return <VehicleLayout title="月次レポート" subtitle="1ヶ月分の運行記録"><p className="text-muted-foreground">端末内データを読み込んでいます…</p></VehicleLayout>;
  }

  return (
    <VehicleLayout title="月次レポート" subtitle="1ヶ月分の運行記録">
      {error && <p className="no-print mb-5 rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">{error}</p>}

      <section className="no-print card-elegant mb-6 p-4">
        <p className="mb-3 text-xs font-medium text-muted-foreground">対象サイクルを選択</p>
        <select className="input-elegant mb-3 text-sm" value={activeCycle.id} onChange={(event) => setSelectedCycleId(event.target.value)} aria-label="対象サイクルを選択">
          {cycles.map((cycle) => (
            <option key={cycle.id} value={cycle.id}>
              {formatDateJP(cycle.cycleStartDate)} 〜 {formatDateJP(cycle.cycleEndDate)}{cycle.id === currentCycle.id ? "（今月）" : ""}
            </option>
          ))}
        </select>

        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={goToPreviousCycle} disabled={activeIndex >= cycles.length - 1} className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40" style={{ backgroundColor: "#f3f4f6", color: "#374151" }}>
            <ChevronLeft className="h-4 w-4" />前のサイクル
          </button>
          <span className="flex-1 text-center text-sm font-medium" style={{ color: "#1d4ed8" }}>
            {formatDateJP(activeCycle.cycleStartDate)} 〜 {formatDateJP(activeCycle.cycleEndDate)}
            {activeCycle.id === currentCycle.id && <span className="ml-2 rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: "#dbeafe", color: "#1d4ed8" }}>今月</span>}
          </span>
          <button type="button" onClick={goToNextCycle} disabled={activeIndex <= 0} className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40" style={{ backgroundColor: "#f3f4f6", color: "#374151" }}>
            次のサイクル<ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <article className="print-container rounded-lg border border-border bg-white p-6 shadow-sm">
        <div className="mb-4 border-b-2 pb-3" style={{ borderColor: "#333" }}>
          <h1 className="mb-2 text-center text-xl font-bold" style={{ color: "#000" }}>車両運行日報</h1>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p style={{ color: "#666" }}>運転者名</p><p className="text-base font-semibold" style={{ color: "#000" }}>{driverName}</p></div>
            <div><p style={{ color: "#666" }}>車両番号</p><p className="text-base font-semibold" style={{ color: "#000" }}>{vehicleNumber}</p></div>
          </div>
          <p className="mt-2 text-center text-sm" style={{ color: "#666" }}>対象期間：{formatDateJP(activeCycle.cycleStartDate)} 〜 {formatDateJP(activeCycle.cycleEndDate)}</p>
        </div>

        <div className="mb-4 overflow-x-auto">
          <table className="print-table w-full border-collapse text-sm">
            <thead><tr>{["日付", "出発時間", "終了時間", "出発距離", "終了距離", "走行距離", "稼働件数"].map((header) => <th key={header} className="border px-2 py-2 text-xs font-bold" style={{ backgroundColor: "#e5e5e5", borderColor: "#333", color: "#000" }}>{header}</th>)}</tr></thead>
            <tbody>
              {records.length === 0 ? <tr><td colSpan={7} className="border px-2 py-8 text-center text-xs" style={{ color: "#888", borderColor: "#333" }}>記録がありません</td></tr> : records.map((record) => {
                const incomplete = record.arrivalDistance === null;
                const incompleteStyle = { color: "#b45309", borderColor: "#333" };
                const normalStyle = { color: "#000", borderColor: "#333" };
                return <tr key={record.id}>
                  <td className="border px-2 py-1 text-xs" style={normalStyle}>{formatDateJP(record.recordDate)}</td>
                  <td className="border px-2 py-1 text-center text-xs" style={normalStyle}>{record.departureTime}</td>
                  <td className="border px-2 py-1 text-center text-xs" style={incomplete ? incompleteStyle : normalStyle}>{record.arrivalTime ?? "未入力"}</td>
                  <td className="border px-2 py-1 text-right text-xs" style={normalStyle}>{record.departureDistance.toFixed(1)}</td>
                  <td className="border px-2 py-1 text-right text-xs" style={incomplete ? incompleteStyle : normalStyle}>{record.arrivalDistance?.toFixed(1) ?? "-"}</td>
                  <td className="border px-2 py-1 text-right text-xs font-semibold" style={incomplete ? incompleteStyle : normalStyle}>{incomplete ? "-" : calculateDistance(record).toFixed(1)}</td>
                  <td className="border px-2 py-1 text-center text-xs" style={{ color: "#444", borderColor: "#333" }}>{record.jobCount != null ? `${record.jobCount}件` : ""}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t-2 pt-3" style={{ borderColor: "#333" }}><div className="flex items-center justify-between"><p style={{ color: "#000" }}>記録日数：<span className="text-lg font-bold">{records.length}日</span></p><p style={{ color: "#000" }}>総走行距離：<span className="text-lg font-bold">{totalDistance.toFixed(1)} km</span></p></div></div>

        <section className="print-gasoline mt-4 border border-neutral-400 bg-neutral-50 p-3 text-sm"><p className="mb-2 text-xs text-neutral-600">※給与計算担当者記載</p><p>ガソリン代：<span className="inline-block min-w-12 border-b border-black">　</span>円（単価）× 総距離数 <strong>{totalDistance.toFixed(1)} km</strong> ＝ <span className="inline-block min-w-20 border-b border-black">　</span>円</p></section>
        <p className="print-footer mt-4 text-right text-xs text-muted-foreground">印刷日：{formatDateJP(todayJST())}</p>
      </article>

      <div className="no-print mt-8"><div className="mb-3 grid grid-cols-2 gap-3"><button type="button" onClick={() => window.print()} className="flex items-center justify-center gap-2 rounded-lg py-3 font-medium text-white shadow-md transition-all" style={{ backgroundColor: "#1d4ed8" }}><Printer className="h-5 w-5" />印刷</button><button type="button" onClick={() => window.print()} className="flex items-center justify-center gap-2 rounded-lg py-3 font-medium text-white shadow-md transition-all" style={{ backgroundColor: "#059669" }}><Download className="h-5 w-5" />PDFに保存</button></div><Link href="/" className="btn-secondary flex w-full items-center justify-center gap-2 py-3"><ArrowLeft className="h-5 w-5" />ホーム</Link><p className="mt-3 text-center text-xs" style={{ color: "#888" }}>※「PDFに保存」は印刷画面で保存先を「PDFに保存」に選択してください。</p></div>
    </VehicleLayout>
  );
}
