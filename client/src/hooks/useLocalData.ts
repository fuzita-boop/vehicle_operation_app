import { useCallback, useEffect, useState } from "react";
import { getLocalData, LocalAppData, subscribeToLocalData } from "@/lib/localDb";

export function useLocalData() {
  const [data, setData] = useState<LocalAppData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setData(await getLocalData());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "端末内データの読み込みに失敗しました");
    }
  }, []);

  useEffect(() => {
    void refresh();
    return subscribeToLocalData(() => void refresh());
  }, [refresh]);

  return { data, error, refresh, isLoading: data === null && error === null };
}
