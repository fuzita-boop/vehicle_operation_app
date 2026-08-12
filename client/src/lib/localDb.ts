export type LocalRecord = {
  id: string;
  cycleId: string;
  recordDate: string;
  departureTime: string;
  arrivalTime: string | null;
  departureDistance: number;
  arrivalDistance: number | null;
  jobCount: number | null;
  createdAt: string;
  updatedAt: string;
};

export type LocalCycle = {
  id: string;
  cycleStartDate: string;
  cycleEndDate: string;
  createdAt: string;
};

export type LocalProfile = {
  id: "profile";
  driverName: string;
  vehicleNumber: string;
  updatedAt: string;
};

export type LocalAppData = {
  profile: LocalProfile;
  cycles: LocalCycle[];
  records: LocalRecord[];
};

export type LocalBackup = {
  format: "vehicle-operation-pwa-backup";
  version: 1;
  exportedAt: string;
  data: LocalAppData;
};

const DB_NAME = "vehicle-operation-pwa";
const DB_VERSION = 1;
const CHANGE_EVENT = "vehicle-operation-local-data-changed";

const DEFAULT_PROFILE: LocalProfile = {
  id: "profile",
  driverName: "",
  vehicleNumber: "",
  updatedAt: "",
};

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDBの操作に失敗しました"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDBの保存に失敗しました"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDBの操作が中断されました"));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("profile")) {
        database.createObjectStore("profile", { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains("cycles")) {
        database.createObjectStore("cycles", { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains("records")) {
        const records = database.createObjectStore("records", { keyPath: "id" });
        records.createIndex("cycleId", "cycleId", { unique: false });
        records.createIndex("recordDate", "recordDate", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDBを開けませんでした"));
  });
}

function notifyChanged() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeToLocalData(listener: () => void) {
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}

export function todayJST(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function addMonths(year: number, month: number, offset: number) {
  const total = year * 12 + (month - 1) + offset;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getCycleForDate(recordDate: string): LocalCycle {
  const [year, month, day] = recordDate.split("-").map(Number);
  const start = day >= 16 ? { year, month } : addMonths(year, month, -1);
  const end = day >= 16 ? addMonths(year, month, 1) : { year, month };
  const cycleStartDate = isoDate(start.year, start.month, 16);
  return {
    id: `cycle-${cycleStartDate}`,
    cycleStartDate,
    cycleEndDate: isoDate(end.year, end.month, 15),
    createdAt: new Date().toISOString(),
  };
}

export function formatDateJP(value: string) {
  const [year, month, day] = value.split("-");
  return `${year}/${month}/${day}`;
}

export function selectIncompleteArrivalTarget(records: LocalRecord[], requestedRecordId: string | null) {
  const incomplete = records.filter((record) => record.arrivalTime === null || record.arrivalDistance === null);
  if (requestedRecordId) {
    const requested = incomplete.find((record) => record.id === requestedRecordId);
    if (requested) return requested;
  }
  return incomplete.at(-1) ?? null;
}

function makeId(prefix: string) {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeRecord(source: Partial<LocalRecord>): LocalRecord {
  const recordDate = String(source.recordDate ?? todayJST()).slice(0, 10);
  const now = new Date().toISOString();
  const departureDistance = Number(source.departureDistance);
  const arrivalDistance = source.arrivalDistance === null || source.arrivalDistance === undefined
    ? null
    : Number(source.arrivalDistance);
  const jobCount = source.jobCount === null || source.jobCount === undefined
    ? null
    : Number(source.jobCount);
  return {
    id: source.id ?? makeId("record"),
    cycleId: source.cycleId ?? getCycleForDate(recordDate).id,
    recordDate,
    departureTime: String(source.departureTime ?? ""),
    arrivalTime: source.arrivalTime ? String(source.arrivalTime) : null,
    departureDistance: Number.isFinite(departureDistance) ? departureDistance : 0,
    arrivalDistance: arrivalDistance !== null && Number.isFinite(arrivalDistance) ? arrivalDistance : null,
    jobCount: jobCount !== null && Number.isFinite(jobCount) ? Math.max(0, Math.floor(jobCount)) : null,
    createdAt: source.createdAt ?? now,
    updatedAt: now,
  };
}

async function ensureCycle(database: IDBDatabase, recordDate: string) {
  const cycle = getCycleForDate(recordDate);
  const transaction = database.transaction("cycles", "readwrite");
  const store = transaction.objectStore("cycles");
  const existing = await requestResult(store.get(cycle.id));
  if (!existing) store.put(cycle);
  await transactionDone(transaction);
  return cycle;
}

export async function getLocalData(): Promise<LocalAppData> {
  const database = await openDatabase();
  try {
    await ensureCycle(database, todayJST());
    const transaction = database.transaction(["profile", "cycles", "records"], "readonly");
    const profile = await requestResult(transaction.objectStore("profile").get("profile")) as LocalProfile | undefined;
    const cycles = await requestResult(transaction.objectStore("cycles").getAll()) as LocalCycle[];
    const records = await requestResult(transaction.objectStore("records").getAll()) as LocalRecord[];
    await transactionDone(transaction);
    return {
      profile: profile ?? { ...DEFAULT_PROFILE },
      cycles: cycles.sort((a, b) => b.cycleStartDate.localeCompare(a.cycleStartDate)),
      records: records.sort((a, b) => a.recordDate.localeCompare(b.recordDate) || a.createdAt.localeCompare(b.createdAt)),
    };
  } finally {
    database.close();
  }
}

export async function saveProfile(update: Pick<LocalProfile, "driverName" | "vehicleNumber">) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction("profile", "readwrite");
    const store = transaction.objectStore("profile");
    const existing = await requestResult(store.get("profile")) as LocalProfile | undefined;
    store.put({
      ...DEFAULT_PROFILE,
      ...existing,
      ...update,
      id: "profile",
      updatedAt: new Date().toISOString(),
    } satisfies LocalProfile);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
  notifyChanged();
}

export async function addLocalRecord(input: Omit<LocalRecord, "id" | "cycleId" | "createdAt" | "updatedAt">) {
  const database = await openDatabase();
  try {
    const cycle = await ensureCycle(database, input.recordDate);
    const record = normalizeRecord({ ...input, cycleId: cycle.id });
    const transaction = database.transaction("records", "readwrite");
    transaction.objectStore("records").put(record);
    await transactionDone(transaction);
    return record;
  } finally {
    database.close();
    notifyChanged();
  }
}

export async function updateLocalRecord(id: string, update: Partial<Omit<LocalRecord, "id" | "createdAt">>) {
  const database = await openDatabase();
  try {
    const readTransaction = database.transaction("records", "readonly");
    const existing = await requestResult(readTransaction.objectStore("records").get(id)) as LocalRecord | undefined;
    await transactionDone(readTransaction);
    if (!existing) throw new Error("編集対象の記録が見つかりません");
    const recordDate = String(update.recordDate ?? existing.recordDate).slice(0, 10);
    const cycle = await ensureCycle(database, recordDate);
    const updated = normalizeRecord({ ...existing, ...update, recordDate, cycleId: cycle.id, createdAt: existing.createdAt });
    const writeTransaction = database.transaction("records", "readwrite");
    writeTransaction.objectStore("records").put(updated);
    await transactionDone(writeTransaction);
    return updated;
  } finally {
    database.close();
    notifyChanged();
  }
}

export async function deleteLocalRecord(id: string) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction("records", "readwrite");
    transaction.objectStore("records").delete(id);
    await transactionDone(transaction);
  } finally {
    database.close();
    notifyChanged();
  }
}

export async function exportLocalBackup(): Promise<LocalBackup> {
  return {
    format: "vehicle-operation-pwa-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: await getLocalData(),
  };
}

export async function importLocalBackup(source: unknown, mode: "merge" | "replace" = "merge") {
  if (!source || typeof source !== "object") throw new Error("バックアップファイルの形式が正しくありません");
  const backup = source as Partial<LocalBackup>;
  if (backup.format !== "vehicle-operation-pwa-backup" || backup.version !== 1 || !backup.data) {
    throw new Error("このアプリ用のバックアップJSONではありません");
  }
  const incoming = backup.data as Partial<LocalAppData>;
  const database = await openDatabase();
  try {
    const transaction = database.transaction(["profile", "cycles", "records"], "readwrite");
    const profileStore = transaction.objectStore("profile");
    const cyclesStore = transaction.objectStore("cycles");
    const recordsStore = transaction.objectStore("records");
    if (mode === "replace") {
      profileStore.clear();
      cyclesStore.clear();
      recordsStore.clear();
    }
    if (incoming.profile) {
      const existing = mode === "merge" ? await requestResult(profileStore.get("profile")) as LocalProfile | undefined : undefined;
      profileStore.put({
        ...DEFAULT_PROFILE,
        ...existing,
        ...incoming.profile,
        id: "profile",
        updatedAt: new Date().toISOString(),
      } satisfies LocalProfile);
    }
    for (const cycle of incoming.cycles ?? []) {
      if (cycle?.cycleStartDate && cycle?.cycleEndDate) {
        cyclesStore.put({ ...getCycleForDate(String(cycle.cycleStartDate)), ...cycle });
      }
    }
    for (const sourceRecord of incoming.records ?? []) {
      if (!sourceRecord?.recordDate || !sourceRecord?.departureTime) continue;
      const record = normalizeRecord(sourceRecord);
      const cycle = getCycleForDate(record.recordDate);
      cyclesStore.put(cycle);
      recordsStore.put({ ...record, cycleId: cycle.id });
    }
    await transactionDone(transaction);
  } finally {
    database.close();
  }
  notifyChanged();
}

export async function clearLocalData() {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(["profile", "cycles", "records"], "readwrite");
    transaction.objectStore("profile").clear();
    transaction.objectStore("cycles").clear();
    transaction.objectStore("records").clear();
    await transactionDone(transaction);
  } finally {
    database.close();
  }
  notifyChanged();
}
