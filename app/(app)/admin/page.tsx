"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { CheckCircle2, Eye, EyeOff, Info, PanelRightClose, PanelRightOpen } from "lucide-react";
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

const createDesk = (id: string, number: number, unit: number, x: number, y: number): Desk => ({
  id,
  number,
  x,
  y,
  width: unit,
  height: unit,
  label: null,
  occupantFirstName: null,
  occupantLastName: null
});

const DeskMap = dynamic(() => import("@/components/map/DeskMap").then((m) => m.DeskMap), { ssr: false });

type MapStyle = Pick<
  MapConfig,
  | "brandLogoUrl"
  | "brandTitle"
  | "brandSubtitle"
  | "deskColor"
  | "deskTextColor"
  | "deskShape"
  | "labelPosition"
  | "showName"
  | "showNumber"
  | "deskTextSize"
  | "deskVisibleWhenSearching"
  | "gridSize"
  | "gridVisible"
>;

type SettingsTab = "desk" | "grid" | "searchbar" | "config";

export default function AdminPage() {
  const { data, loading, error, saveDesks, setData } = useDeskData();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const configFileInputRef = useRef<HTMLInputElement | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [gridEnabled, setGridEnabled] = useState(true);
  const [gridSize, setGridSize] = useState(10);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("desk");
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [showMapImportInfo, setShowMapImportInfo] = useState(false);
  const [entraLoading, setEntraLoading] = useState(true);
  const [showTenantId, setShowTenantId] = useState(false);
  const [showClientId, setShowClientId] = useState(false);
  const [hasStoredClientSecret, setHasStoredClientSecret] = useState(false);
  const [lastCreatedDeskId, setLastCreatedDeskId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const savedSnapshotRef = useRef<string | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>({
    brandLogoUrl: "",
    brandTitle: "DeskMap",
    brandSubtitle: "Premium seating intelligence",
    deskColor: "#8764B8",
    deskTextColor: "#334155",
    deskShape: "rounded",
    labelPosition: "top-center",
    showName: true,
    showNumber: true,
    deskTextSize: 14,
    deskVisibleWhenSearching: false,
    gridSize: 10,
    gridVisible: true
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
    viewerGroupId: "",
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
            viewerGroupId: payload.config.viewerGroupId ?? "",
            authMode: payload.config.authMode ?? "public"
          }));
          setHasStoredClientSecret(Boolean(payload.config.hasClientSecret));
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
      brandLogoUrl: data.map.brandLogoUrl ?? "",
      brandTitle: data.map.brandTitle ?? "DeskMap",
      brandSubtitle: data.map.brandSubtitle ?? "Premium seating intelligence",
      deskColor: data.map.deskColor ?? "#8764B8",
      deskTextColor: data.map.deskTextColor ?? "#334155",
      deskShape: data.map.deskShape ?? "rounded",
      labelPosition: data.map.labelPosition ?? "top-center",
      showName: data.map.showName ?? true,
      showNumber: data.map.showNumber ?? true,
      deskTextSize: data.map.deskTextSize ?? 14,
      deskVisibleWhenSearching: data.map.deskVisibleWhenSearching ?? false,
      gridSize: data.map.gridSize ?? 10,
      gridVisible: data.map.gridVisible ?? true
    });
    setGridSize(data.map.gridSize ?? 10);
    setGridEnabled(data.map.gridVisible ?? true);
    setMapSize({
      width: data.map.width ?? 1200,
      height: data.map.height ?? 700
    });
    savedSnapshotRef.current = JSON.stringify({
      desks: data.desks,
      mapStyle: {
        brandLogoUrl: data.map.brandLogoUrl ?? "",
        brandTitle: data.map.brandTitle ?? "DeskMap",
        brandSubtitle: data.map.brandSubtitle ?? "Premium seating intelligence",
        deskColor: data.map.deskColor ?? "#8764B8",
        deskTextColor: data.map.deskTextColor ?? "#334155",
        deskShape: data.map.deskShape ?? "rounded",
        labelPosition: data.map.labelPosition ?? "top-center",
        showName: data.map.showName ?? true,
        showNumber: data.map.showNumber ?? true,
        deskTextSize: data.map.deskTextSize ?? 14,
        deskVisibleWhenSearching: data.map.deskVisibleWhenSearching ?? false,
        gridSize: data.map.gridSize ?? 10,
        gridVisible: data.map.gridVisible ?? true,
        width: data.map.width ?? 1200,
        height: data.map.height ?? 700
      }
    });
    setIsDirty(false);
  }, [data?.map?.id, data?.map?.updatedAt]);

  const nextDeskNumber = useMemo(() => {
    const numbers = new Set(desks.map((desk) => desk.number));
    let candidate = 1;
    while (numbers.has(candidate)) candidate += 1;
    return candidate;
  }, [desks]);

  useEffect(() => {
    const currentSnapshot = JSON.stringify({
      desks,
      mapStyle: {
        ...mapStyle,
        gridSize,
        gridVisible: gridEnabled,
        width: mapSize.width,
        height: mapSize.height
      }
    });
    const dirty = savedSnapshotRef.current !== null && currentSnapshot !== savedSnapshotRef.current;
    setIsDirty(dirty);
  }, [desks, mapStyle, gridSize, gridEnabled, mapSize.width, mapSize.height]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("deskmap.unsavedChanges", isDirty ? "1" : "0");
  }, [isDirty]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const handleAddDesk = () => {
    if (!data) return;
    const unit = Math.max(1, gridSize);
    const anchor = lastCreatedDeskId ? desks.find((desk) => desk.id === lastCreatedDeskId) : null;
    const x = anchor ? anchor.x + anchor.width + unit : 120;
    const y = anchor ? anchor.y : 120;
    const id = `desk-${nextDeskNumber}-${Date.now()}`;
    const newDesk = createDesk(id, nextDeskNumber, unit, x, y);
    const next = [...desks, newDesk];
    setData({ ...data, desks: next });
    setLastCreatedDeskId(newDesk.id);
    toast.success(`Desk ${nextDeskNumber} added`);
  };

  const handleSave = async () => {
    if (!saveDesks) return;
    try {
      const payload = await saveDesks(
        desks,
        data
          ? {
              ...data.map,
              ...mapStyle,
              gridSize,
              gridVisible: gridEnabled,
              width: mapSize.width,
              height: mapSize.height
            }
          : undefined
      );
      if (payload) {
        savedSnapshotRef.current = JSON.stringify({
          desks: payload.desks,
          mapStyle: {
            brandLogoUrl: payload.map.brandLogoUrl ?? "",
            brandTitle: payload.map.brandTitle ?? "DeskMap",
            brandSubtitle: payload.map.brandSubtitle ?? "Premium seating intelligence",
            deskColor: payload.map.deskColor ?? "#8764B8",
            deskTextColor: payload.map.deskTextColor ?? "#334155",
            deskShape: payload.map.deskShape ?? "rounded",
            labelPosition: payload.map.labelPosition ?? "top-center",
            showName: payload.map.showName ?? true,
            showNumber: payload.map.showNumber ?? true,
            deskTextSize: payload.map.deskTextSize ?? 14,
            deskVisibleWhenSearching: payload.map.deskVisibleWhenSearching ?? false,
            gridSize: payload.map.gridSize ?? 10,
            gridVisible: payload.map.gridVisible ?? true,
            width: payload.map.width ?? 1200,
            height: payload.map.height ?? 700
          }
        });
      }
      setIsDirty(false);
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

  const handleNormalizeToGrid = () => {
    if (!data || desks.length === 0) return;
    const unit = Math.max(1, gridSize);
    const next = desks.map((desk) => ({
      ...desk,
      x: Math.round(desk.x / unit) * unit,
      y: Math.round(desk.y / unit) * unit,
      width: Math.max(unit, Math.round(desk.width / unit) * unit),
      height: Math.max(unit, Math.round(desk.height / unit) * unit)
    }));
    setData({ ...data, desks: next });
    toast.success(`Normalized ${next.length} desks to ${unit} unit grid`);
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
      setHasStoredClientSecret(Boolean(payload.config.hasClientSecret) || entraConfig.clientSecret.length > 0);
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

  const handleExportConfig = async () => {
    try {
      const res = await fetch("/api/config/export", { cache: "no-store" });
      if (!res.ok) throw new Error("Export failed");
      const payload = await res.json();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `deskmap-config-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Config exported");
    } catch {
      toast.error("Failed to export config");
    }
  };

  const handleImportConfig = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await fetch("/api/config/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json)
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) throw new Error(payload.error || "Import failed");
      await fetch("/api/desks");
      window.location.reload();
    } catch {
      toast.error("Failed to import config");
    } finally {
      if (configFileInputRef.current) configFileInputRef.current.value = "";
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
              {isDirty && <p className="mt-1 text-xs font-medium text-amber-600">Unsaved changes</p>}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={handleAddDesk}>Add Desk {nextDeskNumber}</Button>
              <Button variant="outline" onClick={handleRemoveLast}>Remove Last</Button>
              <Button onClick={handleSave}>Save Layout</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/20 p-2">
              <Button variant={settingsTab === "desk" ? "default" : "ghost"} size="sm" onClick={() => setSettingsTab("desk")}>Desk</Button>
              <Button variant={settingsTab === "grid" ? "default" : "ghost"} size="sm" onClick={() => setSettingsTab("grid")}>Grid</Button>
              <Button variant={settingsTab === "searchbar" ? "default" : "ghost"} size="sm" onClick={() => setSettingsTab("searchbar")}>Searchbar</Button>
              <Button variant={settingsTab === "config" ? "default" : "ghost"} size="sm" onClick={() => setSettingsTab("config")}>Config</Button>
            </div>
            {settingsTab === "desk" && (
              <Card className="mb-4 border border-border/60 bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Desk Settings</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-5">
                  <div className="grid gap-1">
                    <Label htmlFor="deskColor">Desk Color</Label>
                    <Input id="deskColor" type="color" value={mapStyle.deskColor} onChange={(event) => setMapStyle({ ...mapStyle, deskColor: event.target.value })} />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="deskTextColor">Text Color</Label>
                    <Input id="deskTextColor" type="color" value={mapStyle.deskTextColor} onChange={(event) => setMapStyle({ ...mapStyle, deskTextColor: event.target.value })} />
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
                      <option value="center">Center</option>
                      <option value="middle">Middle</option>
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
                  <div className="flex items-center gap-2">
                    <Switch checked={mapStyle.showName} onCheckedChange={(checked) => setMapStyle({ ...mapStyle, showName: checked })} />
                    <Label>Show Name</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={mapStyle.showNumber} onCheckedChange={(checked) => setMapStyle({ ...mapStyle, showNumber: checked })} />
                    <Label>Show Number</Label>
                  </div>
                </CardContent>
              </Card>
            )}
            {settingsTab === "grid" && (
              <Card className="mb-4 border border-border/60 bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Grid Settings</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-4">
                  <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2">
                    <Switch checked={snapEnabled} onCheckedChange={setSnapEnabled} />
                    <Label>Snap to Grid</Label>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2">
                    <Switch checked={gridEnabled} onCheckedChange={setGridEnabled} />
                    <Label>Show Grid</Label>
                  </div>
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
                  <div className="flex items-end">
                    <Button variant="outline" onClick={handleNormalizeToGrid}>Normalize to Grid Unit</Button>
                  </div>
                </CardContent>
              </Card>
            )}
            {settingsTab === "searchbar" && (
              <Card className="mb-4 border border-border/60 bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Searchbar Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Switch checked={mapStyle.deskVisibleWhenSearching} onCheckedChange={(checked) => setMapStyle({ ...mapStyle, deskVisibleWhenSearching: checked })} />
                    <Label>Desk Visible When Searching</Label>
                  </div>
                </CardContent>
              </Card>
            )}
            {settingsTab === "config" && (
              <Card className="mb-4 border border-border/60 bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Config Settings</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-1 md:col-span-2">
                    <Label htmlFor="brandLogoUrl">Logo URL (optional)</Label>
                    <Input id="brandLogoUrl" value={mapStyle.brandLogoUrl ?? ""} onChange={(event) => setMapStyle({ ...mapStyle, brandLogoUrl: event.target.value })} placeholder="https://..." />
                    <p className="text-xs text-muted-foreground">
                      Paste a public image URL (for example `https://your-domain/logo.png`). Local file paths are not supported here.
                    </p>
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="brandTitle">Header Title</Label>
                    <Input id="brandTitle" value={mapStyle.brandTitle ?? ""} onChange={(event) => setMapStyle({ ...mapStyle, brandTitle: event.target.value })} />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="brandSubtitle">Header Subtitle</Label>
                    <Input id="brandSubtitle" value={mapStyle.brandSubtitle ?? ""} onChange={(event) => setMapStyle({ ...mapStyle, brandSubtitle: event.target.value })} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:col-span-2">
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>Import Building Map</Button>
                    <Button variant="ghost" size="icon" onClick={() => setShowMapImportInfo((prev) => !prev)} aria-label="Map import information">
                      <Info className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" onClick={handleExportConfig}>Export Config</Button>
                    <Button variant="outline" onClick={() => configFileInputRef.current?.click()}>Import Config</Button>
                  </div>
                </CardContent>
              </Card>
            )}
            {showMapImportInfo && (
              <div className="mb-4 rounded-lg border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground">
                Best: SVG (sharp at any zoom, smallest size for floor plans, ideal for pan/zoom). Good fallback: PNG (use high resolution, e.g. 3000px+ wide). Use JPG only for photo-like maps (lossy text/lines).
              </div>
            )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg"
                className="hidden"
                onChange={handleMapUpload}
                aria-label="Import building map"
              />
              <input
                ref={configFileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleImportConfig}
                aria-label="Import deskmap configuration"
              />
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
              <p className="text-sm text-muted-foreground">Configure Graph access and seat mapping rules. Graph API must include `User.Read.All` (application permission) with admin consent. Secrets are encrypted at rest.</p>
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
                  <div className="flex gap-2">
                    <Input id="tenantId" type={showTenantId ? "text" : "password"} value={entraConfig.tenantId} onChange={(event) => setEntraConfig({ ...entraConfig, tenantId: event.target.value })} placeholder="00000000-0000-0000-0000-000000000000" />
                    <Button type="button" variant="outline" onClick={() => setShowTenantId((prev) => !prev)}>{showTenantId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="clientId">Client ID</Label>
                  <div className="flex gap-2">
                    <Input id="clientId" type={showClientId ? "text" : "password"} value={entraConfig.clientId} onChange={(event) => setEntraConfig({ ...entraConfig, clientId: event.target.value })} placeholder="00000000-0000-0000-0000-000000000000" />
                    <Button type="button" variant="outline" onClick={() => setShowClientId((prev) => !prev)}>{showClientId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="clientSecret">Client Secret</Label>
                  <Input id="clientSecret" type="password" value={entraConfig.clientSecret} onChange={(event) => setEntraConfig({ ...entraConfig, clientSecret: event.target.value })} placeholder="Store securely" />
                  {hasStoredClientSecret && entraConfig.clientSecret.length === 0 && (
                    <div className="flex items-center gap-1 text-xs text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Client secret is already saved.
                    </div>
                  )}
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
                  <Label htmlFor="mappingRegex">Advanced Desk Match (optional)</Label>
                  <Input id="mappingRegex" value={entraConfig.mappingRegex} onChange={(event) => setEntraConfig({ ...entraConfig, mappingRegex: event.target.value })} placeholder="Desk-(\\d+)" />
                  <p className="text-xs text-muted-foreground">Only needed for special formats. Leave empty for normal values like `1`, `2`, or `Desk-1`.</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="syncInterval">Sync Interval (minutes)</Label>
                  <Input id="syncInterval" type="number" min={5} value={entraConfig.syncIntervalMinutes} onChange={(event) => setEntraConfig({ ...entraConfig, syncIntervalMinutes: Number(event.target.value) })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="adminGroupId">Admin Group Object ID</Label>
                  <Input id="adminGroupId" value={entraConfig.adminGroupId} onChange={(event) => setEntraConfig({ ...entraConfig, adminGroupId: event.target.value })} />
                  <p className="text-xs text-muted-foreground">Users in this group can access Admin Studio. Leave blank to disable admin group restriction.</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="viewerGroupId">Viewer Group Object ID</Label>
                  <Input id="viewerGroupId" value={entraConfig.viewerGroupId} onChange={(event) => setEntraConfig({ ...entraConfig, viewerGroupId: event.target.value })} />
                  <p className="text-xs text-muted-foreground">Used when App Access Mode is set to `Viewer group only`.</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="authMode">App Access Mode</Label>
                  <Select id="authMode" value={entraConfig.authMode} onChange={(event) => setEntraConfig({ ...entraConfig, authMode: event.target.value })}>
                    <option value="public">Public (no login)</option>
                    <option value="entra">Entra login required</option>
                    <option value="viewer-group">Viewer group only</option>
                  </Select>
                  <p className="text-xs text-muted-foreground">Sessions are kept for about 24 hours before sign-in is required again.</p>
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
