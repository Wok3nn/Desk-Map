"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Info, PanelRightClose, PanelRightOpen } from "lucide-react";
import { toast } from "sonner";
import { useDeskData } from "@/components/map/useDeskData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Desk, MapConfig } from "@/lib/types";

const createDesk = (number: number, unit: number): Desk => ({
  id: `desk-${number}-${Date.now()}`,
  number,
  x: 120,
  y: 120,
  width: unit,
  height: unit,
  label: null,
  occupantFirstName: null,
  occupantLastName: null
});

const DeskMap = dynamic(() => import("@/components/map/DeskMap").then((m) => m.DeskMap), { ssr: false });

type MapStyle = Pick<
  MapConfig,
  "deskColor" | "deskShape" | "labelPosition" | "showName" | "showNumber" | "deskTextSize" | "deskVisibleWhenSearching"
>;

export default function AdminPage() {
  const { data, loading, error, saveDesks, setData } = useDeskData();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [gridEnabled, setGridEnabled] = useState(true);
  const [gridSize, setGridSize] = useState(10);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [showMapImportInfo, setShowMapImportInfo] = useState(false);
  const [entraLoading, setEntraLoading] = useState(true);
  const [mapStyle, setMapStyle] = useState<MapStyle>({
    deskColor: "#8764B8",
    deskShape: "rounded",
    labelPosition: "top-center",
    showName: true,
    showNumber: true,
    deskTextSize: 14,
    deskVisibleWhenSearching: false
  });
  const [mapSize, setMapSize] = useState({ width: 1200, height: 700 });
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
      } catch {
        toast.error("Unable to load Entra settings");
      } finally {
        setEntraLoading(false);
      }
    };

    loadConfig();
  }, []);

  useEffect(() => {
    if (!data?.map) return;
    setMapStyle({
      deskColor: data.map.deskColor ?? "#8764B8",
      deskShape: data.map.deskShape ?? "rounded",
      labelPosition: data.map.labelPosition ?? "top-center",
      showName: data.map.showName ?? true,
      showNumber: data.map.showNumber ?? true,
      deskTextSize: data.map.deskTextSize ?? 14,
      deskVisibleWhenSearching: data.map.deskVisibleWhenSearching ?? false
    });
    setMapSize({
      width: data.map.width ?? 1200,
      height: data.map.height ?? 700
    });
  }, [data?.map]);

  const nextDeskNumber = useMemo(() => {
    const numbers = new Set(desks.map((desk) => desk.number));
    let candidate = 1;
    while (numbers.has(candidate)) candidate += 1;
    return candidate;
  }, [desks]);

  const handleAddDesk = () => {
    if (!data) return;
    const unit = Math.max(1, gridSize);
    const next = [...desks, createDesk(nextDeskNumber, unit)];
    setData({ ...data, desks: next });
    toast.success(`Desk ${nextDeskNumber} added`);
  };

  const handleSave = async () => {
    if (!saveDesks) return;
    try {
      await saveDesks(
        desks,
        data
          ? {
              ...data.map,
              ...mapStyle,
              width: mapSize.width,
              height: mapSize.height
            }
          : undefined
      );
      toast.success("Layout saved and synced");
    } catch {
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
    } catch {
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

  const handleMapUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !data) return;

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/map/upload", {
        method: "POST",
        body: formData
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Upload failed");
      setData({ ...data, map: payload.map });
      toast.success("Building map imported");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
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
            <div className="h-[calc(100vh-220px)] min-h-[660px] w-full rounded-2xl border border-border/60 bg-muted/40 shimmer" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className={cn("grid gap-6 transition-[padding] duration-300", settingsOpen && "xl:pr-[430px]")}>
        <Card>
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Admin Studio</CardTitle>
              <p className="text-sm text-muted-foreground">Drag to move, use handles to resize, hold Ctrl or right-drag to pan.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-border/60 px-3 py-2 text-xs text-muted-foreground">
                <span>Snap to grid</span>
                <Switch checked={snapEnabled} onCheckedChange={setSnapEnabled} />
              </div>
              <div className="flex items-center gap-2 rounded-full border border-border/60 px-3 py-2 text-xs text-muted-foreground">
                <span>Grid</span>
                <Switch checked={gridEnabled} onCheckedChange={setGridEnabled} />
              </div>
              <Button variant="secondary" onClick={handleAddDesk}>Add Desk {nextDeskNumber}</Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>Import Building Map</Button>
              <Button variant="ghost" size="icon" onClick={() => setShowMapImportInfo((prev) => !prev)} aria-label="Map import information">
                <Info className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={handleRemoveLast}>Remove Last</Button>
              <Button onClick={handleSave}>Save Layout</Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg"
                className="hidden"
                onChange={handleMapUpload}
                aria-label="Import building map"
              />
            </div>
          </CardHeader>
          <CardContent>
            {showMapImportInfo && (
              <div className="mb-4 rounded-lg border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground">
                Best: SVG (sharp at any zoom, smallest size for floor plans, ideal for pan/zoom). Good fallback: PNG (use high resolution, e.g. 3000px+ wide). Use JPG only for photo-like maps (lossy text/lines).
              </div>
            )}
            <div className="mb-4 grid gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 md:grid-cols-5">
              <div className="grid gap-1">
                <Label htmlFor="deskColor">Desk Color</Label>
                <Input id="deskColor" type="color" value={mapStyle.deskColor} onChange={(event) => setMapStyle({ ...mapStyle, deskColor: event.target.value })} />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="deskShape">Desk Shape</Label>
                <Select id="deskShape" value={mapStyle.deskShape} onChange={(event) => setMapStyle({ ...mapStyle, deskShape: event.target.value as MapStyle["deskShape"] })}>
                  <option value="rectangle">Rectangle</option>
                  <option value="rounded">Rounded</option>
                  <option value="capsule">Capsule</option>
                  <option value="circle">Circle</option>
                  <option value="diamond">Diamond</option>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="labelPosition">Label Position</Label>
                <Select id="labelPosition" value={mapStyle.labelPosition} onChange={(event) => setMapStyle({ ...mapStyle, labelPosition: event.target.value as MapStyle["labelPosition"] })}>
                  <option value="inside">Inside</option>
                  <option value="top-left">Top Left</option>
                  <option value="top-center">Top Center</option>
                  <option value="top-right">Top Right</option>
                  <option value="middle-left">Middle Left</option>
                  <option value="middle-right">Middle Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="bottom-center">Bottom Center</option>
                  <option value="bottom-right">Bottom Right</option>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="deskTextSize">Desk Text Size</Label>
                <Input
                  id="deskTextSize"
                  type="number"
                  min={1}
                  max={72}
                  value={mapStyle.deskTextSize}
                  onChange={(event) => setMapStyle({ ...mapStyle, deskTextSize: Math.max(1, Math.min(72, Number(event.target.value) || 14)) })}
                />
              </div>
              <div className="flex items-end gap-2">
                <Switch checked={mapStyle.showName} onCheckedChange={(checked) => setMapStyle({ ...mapStyle, showName: checked })} />
                <Label>Show Name</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={mapStyle.showNumber} onCheckedChange={(checked) => setMapStyle({ ...mapStyle, showNumber: checked })} />
                <Label>Show Number</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={mapStyle.deskVisibleWhenSearching} onCheckedChange={(checked) => setMapStyle({ ...mapStyle, deskVisibleWhenSearching: checked })} />
                <Label>Desk Visible When Searching</Label>
              </div>
            </div>
            <div className="mb-4 grid gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 md:grid-cols-4">
              <div className="grid gap-1">
                <Label htmlFor="gridSize">Grid Size</Label>
                <Input id="gridSize" type="number" min={1} value={gridSize} onChange={(event) => setGridSize(Math.max(1, Number(event.target.value) || 1))} />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="mapWidth">Map Width</Label>
                <Input id="mapWidth" type="number" min={200} value={mapSize.width} onChange={(event) => setMapSize({ ...mapSize, width: Math.max(200, Number(event.target.value) || 200) })} />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="mapHeight">Map Height</Label>
                <Input id="mapHeight" type="number" min={200} value={mapSize.height} onChange={(event) => setMapSize({ ...mapSize, height: Math.max(200, Number(event.target.value) || 200) })} />
              </div>
            </div>
            {error ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">{error}</div>
            ) : (
              <DeskMap
                mode="edit"
                map={{ ...data.map, ...mapStyle, width: mapSize.width, height: mapSize.height }}
                desks={desks}
                onChange={(next) => setData({ ...data, desks: next })}
                snapEnabled={snapEnabled}
                gridSize={gridSize}
                showGrid={gridEnabled}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <button
        type="button"
        onClick={() => setSettingsOpen((prev) => !prev)}
        className="fixed right-3 top-1/2 z-40 flex -translate-y-1/2 items-center gap-2 rounded-l-xl border border-border/60 bg-card px-3 py-2 text-xs font-medium text-foreground shadow-soft"
        aria-label={settingsOpen ? "Hide connection settings" : "Show connection settings"}
      >
        {settingsOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
        Connection
      </button>

      <aside
        className={cn(
          "fixed right-0 top-[72px] z-30 h-[calc(100vh-72px)] w-full max-w-[420px] border-l border-border/60 bg-background/95 backdrop-blur-xl transition-transform duration-300",
          settingsOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="h-full overflow-y-auto p-4">
          <Card className="h-full">
            <CardHeader className="gap-3">
              <CardTitle>Microsoft Entra Sync</CardTitle>
              <p className="text-sm text-muted-foreground">Configure Graph access and seat mapping rules. Secrets are encrypted at rest.</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={handleTestEntra} disabled={entraLoading}>Test Connection</Button>
                <Button variant="secondary" onClick={handleSyncEntra} disabled={entraLoading}>Sync Now</Button>
                <Button onClick={handleSaveEntra} disabled={entraLoading}>Save Settings</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="tenantId">Tenant ID</Label>
                  <Input id="tenantId" value={entraConfig.tenantId} onChange={(event) => setEntraConfig({ ...entraConfig, tenantId: event.target.value })} placeholder="00000000-0000-0000-0000-000000000000" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="clientId">Client ID</Label>
                  <Input id="clientId" value={entraConfig.clientId} onChange={(event) => setEntraConfig({ ...entraConfig, clientId: event.target.value })} placeholder="00000000-0000-0000-0000-000000000000" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="clientSecret">Client Secret</Label>
                  <Input id="clientSecret" type="password" value={entraConfig.clientSecret} onChange={(event) => setEntraConfig({ ...entraConfig, clientSecret: event.target.value })} placeholder="Store securely" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="scopes">Scopes</Label>
                  <Textarea id="scopes" value={entraConfig.scopes} onChange={(event) => setEntraConfig({ ...entraConfig, scopes: event.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="mappingPrefix">Office Location Prefix</Label>
                  <Input id="mappingPrefix" value={entraConfig.mappingPrefix} onChange={(event) => setEntraConfig({ ...entraConfig, mappingPrefix: event.target.value })} placeholder="Desk-" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="mappingRegex">Mapping Regex (optional)</Label>
                  <Input id="mappingRegex" value={entraConfig.mappingRegex} onChange={(event) => setEntraConfig({ ...entraConfig, mappingRegex: event.target.value })} placeholder="Desk-(\\d+)" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="syncInterval">Sync Interval (minutes)</Label>
                  <Input id="syncInterval" type="number" min={5} value={entraConfig.syncIntervalMinutes} onChange={(event) => setEntraConfig({ ...entraConfig, syncIntervalMinutes: Number(event.target.value) })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="adminGroupId">Admin Group Object ID</Label>
                  <Input id="adminGroupId" value={entraConfig.adminGroupId} onChange={(event) => setEntraConfig({ ...entraConfig, adminGroupId: event.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="authMode">Viewer Access</Label>
                  <Select id="authMode" value={entraConfig.authMode} onChange={(event) => setEntraConfig({ ...entraConfig, authMode: event.target.value })}>
                    <option value="public">Public (no login)</option>
                    <option value="entra">Entra login required</option>
                  </Select>
                </div>
              </div>
              <div className="mt-6 grid gap-2 text-xs text-muted-foreground">
                <span>Last test: {entraMeta.lastTestAt ? new Date(entraMeta.lastTestAt).toLocaleString() : "Never"}</span>
                <span>Last sync: {entraMeta.lastSyncAt ? new Date(entraMeta.lastSyncAt).toLocaleString() : "Never"}</span>
                <span>Status: {entraMeta.lastSyncStatus ?? "-"}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </aside>
    </div>
  );
}
