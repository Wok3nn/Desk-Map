"use client";

import { useCallback, useEffect, useState } from "react";
import type { LayoutPayload, Desk } from "@/lib/types";

export function useDeskData() {
  const [data, setData] = useState<LayoutPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/desks", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load layout");
      const payload = (await res.json()) as LayoutPayload;
      setData(payload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const es = new EventSource("/api/events");
    const handleUpdate = () => fetchData();
    es.addEventListener("layout", handleUpdate);
    es.addEventListener("connected", handleUpdate);
    es.onerror = () => {
      es.close();
    };
    return () => {
      es.removeEventListener("layout", handleUpdate);
      es.removeEventListener("connected", handleUpdate);
      es.close();
    };
  }, [fetchData]);

  const saveDesks = useCallback(async (desks: Desk[], mapStyle?: LayoutPayload["map"]) => {
    if (!data) return;
    const res = await fetch("/api/desks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        desks,
        mapStyle: mapStyle
          ? {
              deskColor: mapStyle.deskColor,
              deskShape: mapStyle.deskShape,
              deskIcon: mapStyle.deskIcon,
              labelPosition: mapStyle.labelPosition,
              showName: mapStyle.showName,
              showNumber: mapStyle.showNumber,
              width: mapStyle.width,
              height: mapStyle.height
            }
          : undefined
      })
    });
    if (!res.ok) throw new Error("Failed to save layout");
    const payload = (await res.json()) as LayoutPayload;
    setData(payload);
    return payload;
  }, [data]);

  return { data, loading, error, fetchData, saveDesks, setData };
}
