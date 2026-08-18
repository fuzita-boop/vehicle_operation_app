import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { NativePicker } from "./DailyRecord";

describe("NativePicker", () => {
  it("標準dateピッカーを固定幅ラッパー内の操作層として描画する", () => {
    const html = renderToStaticMarkup(
      <NativePicker type="date" value="2026-08-18" onChange={vi.fn()} ariaLabel="記録日を選択" />,
    );

    expect(html).toContain('type="date"');
    expect(html).toContain('aria-label="記録日を選択"');
    expect(html).toContain("absolute inset-0");
    expect(html).toContain("overflow-hidden");
  });

  it("標準timeピッカーを維持する", () => {
    const html = renderToStaticMarkup(
      <NativePicker type="time" value="09:30" onChange={vi.fn()} ariaLabel="出発時間を選択" />,
    );

    expect(html).toContain('type="time"');
    expect(html).toContain("09:30");
  });
});
