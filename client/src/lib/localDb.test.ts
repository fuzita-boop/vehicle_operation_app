import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addLocalRecord, clearLocalData, exportLocalBackup, getCycleForDate, getLocalData, importLocalBackup, saveProfile, selectIncompleteArrivalTarget, updateLocalRecord } from "./localDb";

function deleteDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("vehicle-operation-pwa");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

describe("localDb", () => {
  beforeEach(async () => {
    vi.stubGlobal("window", new EventTarget());
    await deleteDatabase();
  });

  afterEach(async () => {
    await deleteDatabase();
    vi.unstubAllGlobals();
  });

  it("毎月16日〜翌月15日のJSTサイクルを日付文字列から決定する", () => {
    expect(getCycleForDate("2026-04-15")).toMatchObject({ cycleStartDate: "2026-03-16", cycleEndDate: "2026-04-15" });
    expect(getCycleForDate("2026-04-16")).toMatchObject({ cycleStartDate: "2026-04-16", cycleEndDate: "2026-05-15" });
    expect(getCycleForDate("2027-01-01")).toMatchObject({ cycleStartDate: "2026-12-16", cycleEndDate: "2027-01-15" });
  });

  it("プロフィールと日次記録を端末内に保存して更新できる", async () => {
    await saveProfile({ driverName: "藤田 猛", vehicleNumber: "1701" });
    const record = await addLocalRecord({ recordDate: "2026-04-16", departureTime: "08:00", departureDistance: 1000, arrivalTime: null, arrivalDistance: null, jobCount: null });
    await updateLocalRecord(record.id, { arrivalTime: "18:00", arrivalDistance: 1042.5, jobCount: 7 });
    const data = await getLocalData();
    expect(data.profile).toMatchObject({ driverName: "藤田 猛", vehicleNumber: "1701" });
    expect(data.records).toHaveLength(1);
    expect(data.records[0]).toMatchObject({ cycleId: "cycle-2026-04-16", arrivalTime: "18:00", arrivalDistance: 1042.5, jobCount: 7 });
  });

  it("JSONバックアップを別の空の端末内DBへ復元できる", async () => {
    await saveProfile({ driverName: "山田 花子", vehicleNumber: "330" });
    await addLocalRecord({ recordDate: "2026-03-20", departureTime: "09:00", departureDistance: 200, arrivalTime: "17:00", arrivalDistance: 225, jobCount: 3 });
    const backup = await exportLocalBackup();
    await clearLocalData();
    await importLocalBackup(backup, "replace");
    const restored = await getLocalData();
    expect(restored.profile.driverName).toBe("山田 花子");
    expect(restored.records).toHaveLength(1);
    expect(restored.records[0]).toMatchObject({ recordDate: "2026-03-20", arrivalDistance: 225, jobCount: 3 });
  });

  it("帰着未入力バナーでは指定された未完了記録を優先して開き、指定がない場合は最新記録を開く", async () => {
    const completed = await addLocalRecord({ recordDate: "2026-04-16", departureTime: "08:00", departureDistance: 1000, arrivalTime: "12:00", arrivalDistance: 1010, jobCount: 1 });
    const firstIncomplete = await addLocalRecord({ recordDate: "2026-04-16", departureTime: "13:00", departureDistance: 1010, arrivalTime: null, arrivalDistance: null, jobCount: null });
    const latestIncomplete = await addLocalRecord({ recordDate: "2026-04-16", departureTime: "17:00", departureDistance: 1010, arrivalTime: null, arrivalDistance: null, jobCount: null });
    const records = (await getLocalData()).records;

    expect(selectIncompleteArrivalTarget(records, firstIncomplete.id)?.id).toBe(firstIncomplete.id);
    expect(selectIncompleteArrivalTarget(records, completed.id)?.id).toBe(latestIncomplete.id);
    expect(selectIncompleteArrivalTarget(records, null)?.id).toBe(latestIncomplete.id);
  });

  it("誤入力の記録は日付・時刻・距離・稼働件数をまとめて編集でき、変更先のサイクルへ移動する", async () => {
    const record = await addLocalRecord({
      recordDate: "2026-04-15",
      departureTime: "08:00",
      departureDistance: 1000,
      arrivalTime: "17:00",
      arrivalDistance: 1020,
      jobCount: 2,
    });

    await updateLocalRecord(record.id, {
      recordDate: "2026-04-16",
      departureTime: "08:15",
      arrivalTime: "17:30",
      departureDistance: 1010,
      arrivalDistance: 1040.5,
      jobCount: 6,
    });

    const updated = (await getLocalData()).records.find((item) => item.id === record.id);
    expect(updated).toMatchObject({
      recordDate: "2026-04-16",
      cycleId: "cycle-2026-04-16",
      departureTime: "08:15",
      arrivalTime: "17:30",
      departureDistance: 1010,
      arrivalDistance: 1040.5,
      jobCount: 6,
    });
  });
});
