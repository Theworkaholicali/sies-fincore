import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";

export function useApi(url, params, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(() => {
    let active = true;
    setLoading(true);
    api
      .get(url, { params })
      .then((r) => active && setData(r.data))
      .catch((e) => active && setError(e))
      .finally(() => active && setLoading(false));
    return () => (active = false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, JSON.stringify(params)]);

  useEffect(() => {
    const cleanup = refetch();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps.length ? deps : [url, JSON.stringify(params)]);

  return { data, loading, error, refetch };
}
