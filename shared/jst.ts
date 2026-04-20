/**
 * JST（日本標準時 UTC+9）ベースの日付ユーティリティ
 *
 * サーバーはUTCで動作するため、全ての「今日の日付」判定は
 * このモジュールを通じてJSTで行う。
 *
 * 設計方針:
 * - 日付はすべて "YYYY-MM-DD" 文字列で扱う（Date型のタイムゾーンズレを排除）
 * - DBへの保存は noon UTC (12:00:00Z) の Date オブジェクトを使う
 *   → MySQLのDATE型はUTCで保存されるが、noon UTCなら日本時間でも同日になる
 */

/** JST オフセット（ミリ秒） */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 現在のJST日付を "YYYY-MM-DD" 文字列で返す
 */
export function todayJST(): string {
  const now = new Date(Date.now() + JST_OFFSET_MS);
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * "YYYY-MM-DD" 文字列を noon UTC の Date オブジェクトに変換
 * （MySQLのDATE型に安全に保存できる形式）
 */
export function dateStrToNoonUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

/**
 * Date オブジェクトまたは文字列を "YYYY-MM-DD" 文字列に変換
 * DBから取得した cycleStartDate / cycleEndDate の正規化に使う
 */
export function toDateStr(val: Date | string | unknown): string {
  if (val instanceof Date) {
    return `${val.getUTCFullYear()}-${String(val.getUTCMonth() + 1).padStart(2, "0")}-${String(val.getUTCDate()).padStart(2, "0")}`;
  }
  // "2026-04-16T12:00:00.000Z" のような文字列から日付部分を取り出す
  return String(val).split("T")[0];
}

/**
 * 指定した "YYYY-MM-DD" 文字列が属するサイクルの開始日・終了日を返す
 *
 * ルール: 毎月16日〜翌月15日
 *   - day >= 16 → 当月16日〜翌月15日
 *   - day < 16  → 前月16日〜当月15日
 */
export function getCycleDatesForDate(dateStr: string): { cycleStartDate: string; cycleEndDate: string } {
  const [year, month, day] = dateStr.split("-").map(Number);
  // month は 1-indexed

  if (day >= 16) {
    // 当月16日〜翌月15日
    const endYear = month === 12 ? year + 1 : year;
    const endMonth = month === 12 ? 1 : month + 1;
    return {
      cycleStartDate: `${year}-${String(month).padStart(2, "0")}-16`,
      cycleEndDate: `${endYear}-${String(endMonth).padStart(2, "0")}-15`,
    };
  } else {
    // 前月16日〜当月15日
    const startYear = month === 1 ? year - 1 : year;
    const startMonth = month === 1 ? 12 : month - 1;
    return {
      cycleStartDate: `${startYear}-${String(startMonth).padStart(2, "0")}-16`,
      cycleEndDate: `${year}-${String(month).padStart(2, "0")}-15`,
    };
  }
}

/**
 * 現在のJST日付に基づくサイクルの開始日・終了日を返す
 */
export function getCurrentCycleDates(): { cycleStartDate: string; cycleEndDate: string } {
  return getCycleDatesForDate(todayJST());
}
