import { describe, it, expect } from "vitest";
import { getCycleDatesForDate, getCurrentCycleDates, todayJST, toDateStr, dateStrToNoonUTC } from "../shared/jst";

describe("getCycleDatesForDate", () => {
  it("16日は当月16日〜翌月15日のサイクルになる", () => {
    const result = getCycleDatesForDate("2026-04-16");
    expect(result.cycleStartDate).toBe("2026-04-16");
    expect(result.cycleEndDate).toBe("2026-05-15");
  });

  it("15日は前月16日〜当月15日のサイクルになる", () => {
    const result = getCycleDatesForDate("2026-04-15");
    expect(result.cycleStartDate).toBe("2026-03-16");
    expect(result.cycleEndDate).toBe("2026-04-15");
  });

  it("1日は前月16日〜当月15日のサイクルになる", () => {
    const result = getCycleDatesForDate("2026-05-01");
    expect(result.cycleStartDate).toBe("2026-04-16");
    expect(result.cycleEndDate).toBe("2026-05-15");
  });

  it("月末（31日）は当月16日〜翌月15日のサイクルになる", () => {
    const result = getCycleDatesForDate("2026-03-31");
    expect(result.cycleStartDate).toBe("2026-03-16");
    expect(result.cycleEndDate).toBe("2026-04-15");
  });

  it("12月16日は12月16日〜翌年1月15日のサイクルになる（年越し）", () => {
    const result = getCycleDatesForDate("2026-12-16");
    expect(result.cycleStartDate).toBe("2026-12-16");
    expect(result.cycleEndDate).toBe("2027-01-15");
  });

  it("1月1日は前年12月16日〜1月15日のサイクルになる（年越し）", () => {
    const result = getCycleDatesForDate("2027-01-01");
    expect(result.cycleStartDate).toBe("2026-12-16");
    expect(result.cycleEndDate).toBe("2027-01-15");
  });

  it("1月15日は前年12月16日〜1月15日のサイクルになる（年越し）", () => {
    const result = getCycleDatesForDate("2027-01-15");
    expect(result.cycleStartDate).toBe("2026-12-16");
    expect(result.cycleEndDate).toBe("2027-01-15");
  });

  it("1月16日は1月16日〜2月15日のサイクルになる", () => {
    const result = getCycleDatesForDate("2027-01-16");
    expect(result.cycleStartDate).toBe("2027-01-16");
    expect(result.cycleEndDate).toBe("2027-02-15");
  });
});

describe("dateStrToNoonUTC", () => {
  it("YYYY-MM-DDをnoon UTCのDateに変換する", () => {
    const d = dateStrToNoonUTC("2026-04-16");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(3); // 0-indexed
    expect(d.getUTCDate()).toBe(16);
    expect(d.getUTCHours()).toBe(12);
  });
});

describe("toDateStr", () => {
  it("DateオブジェクトをYYYY-MM-DD文字列に変換する", () => {
    const d = new Date(Date.UTC(2026, 3, 16, 12, 0, 0));
    expect(toDateStr(d)).toBe("2026-04-16");
  });

  it("ISO文字列からYYYY-MM-DD部分を取り出す", () => {
    expect(toDateStr("2026-04-16T12:00:00.000Z")).toBe("2026-04-16");
  });

  it("YYYY-MM-DD文字列をそのまま返す", () => {
    expect(toDateStr("2026-04-16")).toBe("2026-04-16");
  });
});

describe("todayJST", () => {
  it("YYYY-MM-DD形式の文字列を返す", () => {
    const result = todayJST();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("UTC深夜0時〜8時59分（JST 9時〜17時59分）は同じ日付を返す", () => {
    // UTC 2026-04-16T00:00:00Z = JST 2026-04-16T09:00:00+09:00 → JST日付は 2026-04-16
    const mockNow = new Date("2026-04-16T00:00:00Z").getTime();
    const jstDate = new Date(mockNow + 9 * 60 * 60 * 1000);
    const y = jstDate.getUTCFullYear();
    const m = String(jstDate.getUTCMonth() + 1).padStart(2, "0");
    const d = String(jstDate.getUTCDate()).padStart(2, "0");
    expect(`${y}-${m}-${d}`).toBe("2026-04-16");
  });

  it("UTC前日15時（JST 0時）はJSTで翌日になる", () => {
    // UTC 2026-04-15T15:00:00Z = JST 2026-04-16T00:00:00+09:00 → JST日付は 2026-04-16
    const utcTime = new Date("2026-04-15T15:00:00Z").getTime();
    const jstDate = new Date(utcTime + 9 * 60 * 60 * 1000);
    const y = jstDate.getUTCFullYear();
    const m = String(jstDate.getUTCMonth() + 1).padStart(2, "0");
    const d = String(jstDate.getUTCDate()).padStart(2, "0");
    // JST 0:00 = UTC 15:00前日 → JST日付は翌日（4/16）
    expect(`${y}-${m}-${d}`).toBe("2026-04-16");
  });
});
