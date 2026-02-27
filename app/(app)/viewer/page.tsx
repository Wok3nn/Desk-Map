"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useDeskData } from "@/components/map/useDeskData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DeskMap = dynamic(() => import("@/components/map/DeskMap").then((m) => m.DeskMap), { ssr: false });

export default function ViewerPage() {
  const { data, loading, error } = useDeskData();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";

  const filtered = useMemo(() => {
    if (!data) return [];
    const search = query.trim().toLowerCase();
    if (!search) return data.desks;

    const matches = data.desks.filter((desk) => {
      const fullName = `${desk.occupantFirstName ?? ""} ${desk.occupantLastName ?? ""}`.toLowerCase();
      return fullName.includes(search) || `${desk.number}`.includes(search);
    });

    if (data.map.deskVisibleWhenSearching) {
      return data.desks;
    }

    return matches;
  }, [data, query]);

  if (loading || !data) {
    return (
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Live Floor Map</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[calc(100vh-220px)] min-h-[660px] w-full rounded-2xl border border-border/60 bg-muted/40 shimmer" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader><CardTitle>Live Floor Map</CardTitle></CardHeader>
        <CardContent>
          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
              {error}
            </div>
          ) : (
            <>
              <div className="mb-3 text-xs text-muted-foreground">Showing {filtered.length} of {data.desks.length} desks</div>
              <DeskMap mode="view" map={data.map} desks={filtered} showGrid={false} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
