"use client";

import dynamic from "next/dynamic";
import { useDeskData } from "@/components/map/useDeskData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DeskMap = dynamic(() => import("@/components/map/DeskMap").then((m) => m.DeskMap), { ssr: false });

export default function ViewerPage() {
  const { data, loading, error } = useDeskData();

  if (loading || !data) {
    return (
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Live Floor Map</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[620px] w-full rounded-2xl border border-border/60 bg-muted/40 shimmer" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Live Floor Map</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
              {error}
            </div>
          ) : (
            <DeskMap mode="view" map={data.map} desks={data.desks} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
