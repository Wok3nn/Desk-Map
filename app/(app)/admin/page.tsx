"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useDeskData } from "@/components/map/useDeskData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import type { Desk } from "@/lib/types";

const createDesk = (number: number): Desk => ({
  id: `desk-${number}-${Date.now()}`,
  number,
  x: 120,
  y: 120,
  width: 140,
  height: 90,
  label: null,
  occupantFirstName: null,
  occupantLastName: null
});

const DeskMap = dynamic(() => import("@/components/map/DeskMap").then((m) => m.DeskMap), { ssr: false });

export default function AdminPage() {
  const { data, loading, error, saveDesks, setData } = useDeskData();
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [entraLoading, setEntraLoading] = useState(true);
  const [entraConfig, setEntraConfig] = useState({
    tenantId: "",
    clientId: "",
    clientSecret: "",
    scopes: "https://graph.microsoft.com/.default",
    syncIntervalMinutes: 15,
    mappingPrefix: "Desk-",
    mappingRegex: "",
    adminGroupId: "",
    authMode: "public"
  });
  const [entraMeta, setEntraMeta] = useState<{ lastTestAt?: string; lastSyncAt?: string; lastSyncStatus?: string }>({});

  const desks = data?.desks ?? [];

  useEffect(() => {
    const loadConfig = async () => {
      try {
        setEntraLoading(true);
        const res = await fetch("/api/entra/config", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load Entra config");
        const payload = await res.json();
        if (payload.config) {
          setEntraConfig((prev) => ({
            ...prev,
            tenantId: payload.config.tenantId ?? "",
            clientId: payload.config.clientId ?? "",
            clientSecret: "",
            scopes: payload.config.scopes ?? prev.scopes,
            syncIntervalMinutes: payload.config.syncIntervalMinutes ?? 15,
            mappingPrefix: payload.config.mappingPrefix ?? prev.mappingPrefix,
            mappingRegex: payload.config.mappingRegex ?? "",
            adminGroupId: payload.config.adminGroupId ?? "",
            authMode: payload.config.authMode ?? "public"
          }));
          setEntraMeta({
            lastTestAt: payload.config.lastTestAt ?? undefined,
            lastSyncAt: payload.config.lastSyncAt ?? undefined,
            lastSyncStatus: payload.config.lastSyncStatus ?? undefined
          });
        }
      } catch (err) {
        toast.error("Unable to load Entra settings");
      } finally {
        setEntraLoading(false);
      }
    };

    loadConfig();
  }, []);

  const nextDeskNumber = useMemo(() => {
    const numbers = new Set(desks.map((desk) => desk.number));
    let candidate = 1;
    while (numbers.has(candidate)) candidate += 1;
    return candidate;
  }, [desks]);

  const handleAddDesk = () => {
    if (!data) return;
    const next = [...desks, createDesk(nextDeskNumber)];
    setData({ ...data, desks: next });
    toast.success(`Desk ${nextDeskNumber} added`);
  };

  const handleSave = async () => {
    if (!saveDesks) return;
    try {
      await saveDesks(desks);
      toast.success("Layout saved and synced");
    } catch (err) {
      toast.error("Failed to save layout");
    }
  };

  const handleRemoveLast = () => {
    if (!data || desks.length === 0) return;
    const next = desks.slice(0, -1);
    setData({ ...data, desks: next });
    toast.message("Removed last desk");
  };

  const handleSaveEntra = async () => {
    try {
      const res = await fetch("/api/entra/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entraConfig)
      });
      if (!res.ok) throw new Error("Failed to save Entra config");
      const payload = await res.json();
      setEntraMeta({
        lastTestAt: payload.config.lastTestAt ?? undefined,
        lastSyncAt: payload.config.lastSyncAt ?? undefined,
        lastSyncStatus: payload.config.lastSyncStatus ?? undefined
      });
      setEntraConfig((prev) => ({ ...prev, clientSecret: "" }));
      toast.success("Entra settings saved");
    } catch (err) {
      toast.error("Failed to save Entra settings");
    }
  };

  const handleTestEntra = async () => {
    try {
      const res = await fetch("/api/entra/test", { method: "POST" });
      const payload = await res.json();
      if (!res.ok || !payload.ok) throw new Error(payload.error || "Test failed");
      toast.success("Entra connection verified");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed");
    }
  };

  const handleSyncEntra = async () => {
    try {
      const res = await fetch("/api/entra/sync", { method: "POST" });
      const payload = await res.json();
      if (!res.ok || !payload.ok) throw new Error(payload.error || "Sync failed");
      toast.success(`Synced ${payload.users} users`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    }
  };

  if (loading || !data) {
    return (
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Admin Studio</CardTitle>
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
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Admin Studio</CardTitle>
            <p className="text-sm text-muted-foreground">
              Drag to move, use handles to resize, hold Space to pan.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-border/60 px-3 py-2 text-xs text-muted-foreground">
              <span>Snap to grid</span>
              <Switch checked={snapEnabled} onCheckedChange={setSnapEnabled} />
            </div>
            <Button variant="secondary" onClick={handleAddDesk}>
              Add Desk {nextDeskNumber}
            </Button>
            <Button variant="outline" onClick={handleRemoveLast}>
              Remove Last
            </Button>
            <Button onClick={handleSave}>Save Layout</Button>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
              {error}
            </div>
          ) : (
            <DeskMap
              mode="edit"
              map={data.map}
              desks={desks}
              onChange={(next) => setData({ ...data, desks: next })}
              snapEnabled={snapEnabled}
            />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Microsoft Entra Sync</CardTitle>
            <p className="text-sm text-muted-foreground">
              Configure Graph access and seat mapping rules. Secrets are encrypted at rest.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handleTestEntra} disabled={entraLoading}>
              Test Connection
            </Button>
            <Button variant="secondary" onClick={handleSyncEntra} disabled={entraLoading}>
              Sync Now
            </Button>
            <Button onClick={handleSaveEntra} disabled={entraLoading}>
              Save Settings
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="tenantId">Tenant ID</Label>
                <Input
                  id="tenantId"
                  value={entraConfig.tenantId}
                  onChange={(event) => setEntraConfig({ ...entraConfig, tenantId: event.target.value })}
                  placeholder="00000000-0000-0000-0000-000000000000"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="clientId">Client ID</Label>
                <Input
                  id="clientId"
                  value={entraConfig.clientId}
                  onChange={(event) => setEntraConfig({ ...entraConfig, clientId: event.target.value })}
                  placeholder="00000000-0000-0000-0000-000000000000"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="clientSecret">Client Secret</Label>
                <Input
                  id="clientSecret"
                  type="password"
                  value={entraConfig.clientSecret}
                  onChange={(event) => setEntraConfig({ ...entraConfig, clientSecret: event.target.value })}
                  placeholder="Store securely"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="scopes">Scopes</Label>
                <Textarea
                  id="scopes"
                  value={entraConfig.scopes}
                  onChange={(event) => setEntraConfig({ ...entraConfig, scopes: event.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="mappingPrefix">Office Location Prefix</Label>
                <Input
                  id="mappingPrefix"
                  value={entraConfig.mappingPrefix}
                  onChange={(event) => setEntraConfig({ ...entraConfig, mappingPrefix: event.target.value })}
                  placeholder="Desk-"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mappingRegex">Mapping Regex (optional)</Label>
                <Input
                  id="mappingRegex"
                  value={entraConfig.mappingRegex}
                  onChange={(event) => setEntraConfig({ ...entraConfig, mappingRegex: event.target.value })}
                  placeholder="Desk-(\\d+)"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="syncInterval">Sync Interval (minutes)</Label>
                <Input
                  id="syncInterval"
                  type="number"
                  min={5}
                  value={entraConfig.syncIntervalMinutes}
                  onChange={(event) =>
                    setEntraConfig({ ...entraConfig, syncIntervalMinutes: Number(event.target.value) })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="adminGroupId">Admin Group Object ID</Label>
                <Input
                  id="adminGroupId"
                  value={entraConfig.adminGroupId}
                  onChange={(event) => setEntraConfig({ ...entraConfig, adminGroupId: event.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="authMode">Viewer Access</Label>
                <Select
                  id="authMode"
                  value={entraConfig.authMode}
                  onChange={(event) => setEntraConfig({ ...entraConfig, authMode: event.target.value })}
                >
                  <option value="public">Public (no login)</option>
                  <option value="entra">Entra login required</option>
                </Select>
              </div>
            </div>
          </div>
          <div className="mt-6 grid gap-2 text-xs text-muted-foreground">
            <span>Last test: {entraMeta.lastTestAt ? new Date(entraMeta.lastTestAt).toLocaleString() : "Never"}</span>
            <span>Last sync: {entraMeta.lastSyncAt ? new Date(entraMeta.lastSyncAt).toLocaleString() : "Never"}</span>
            <span>Status: {entraMeta.lastSyncStatus ?? "?"}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


