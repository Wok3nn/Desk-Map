"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutGrid, Settings, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { MapConfig } from "@/lib/types";

const navItems = [
  { href: "/viewer", label: "Viewer", icon: LayoutGrid },
  { href: "/admin", label: "Admin Studio", icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [brand, setBrand] = useState<Pick<MapConfig, "brandLogoUrl" | "brandTitle" | "brandSubtitle">>({
    brandLogoUrl: null,
    brandTitle: "DeskMap",
    brandSubtitle: "Premium seating intelligence"
  });
  const [resolvedLogoSrc, setResolvedLogoSrc] = useState("/brand-logo.png");
  const viewerQuery = searchParams.get("q") ?? "";
  const isViewer = pathname?.startsWith("/viewer");

  useEffect(() => {
    const loadBranding = async () => {
      try {
        const res = await fetch("/api/desks", { cache: "no-store" });
        if (!res.ok) return;
        const payload = await res.json();
        const map = payload.map as MapConfig | undefined;
        if (!map) return;
        setBrand({
          brandLogoUrl: map.brandLogoUrl ?? null,
          brandTitle: map.brandTitle ?? "DeskMap",
          brandSubtitle: map.brandSubtitle ?? "Premium seating intelligence"
        });
      } catch {
        // Keep defaults.
      }
    };

    loadBranding();
  }, []);

  useEffect(() => {
    const configured = (brand.brandLogoUrl || "").trim();
    setResolvedLogoSrc(configured || "/brand-logo.png");
  }, [brand.brandLogoUrl]);

  const navigateWithDirtyCheck = (href: string) => {
    if (href === pathname) return;
    const hasUnsavedChanges = typeof window !== "undefined" && window.localStorage.getItem("deskmap.unsavedChanges") === "1";
    if (hasUnsavedChanges) {
      const proceed = window.confirm("You have unsaved layout changes. Leave this page without saving?");
      if (!proceed) return;
    }
    router.push(href);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="flex w-full items-center justify-between px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            {resolvedLogoSrc ? (
              <img
                src={resolvedLogoSrc}
                alt={brand.brandTitle ?? "DeskMap"}
                className="h-12 w-12 rounded-lg object-contain bg-slate-100 p-1 shadow-glow"
                onError={() => {
                  if (resolvedLogoSrc !== "/brand-logo.png") {
                    setResolvedLogoSrc("/brand-logo.png");
                  } else {
                    setResolvedLogoSrc("");
                  }
                }}
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 shadow-glow">
                <Sparkles className="h-5 w-5 text-slate-700" />
              </div>
            )}
            <div>
              <p className="font-display text-lg font-semibold tracking-tight">{brand.brandTitle ?? "DeskMap"}</p>
              <p className="text-xs text-muted-foreground">{brand.brandSubtitle ?? "Premium seating intelligence"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {navItems.map((item) => {
              const isActive = pathname?.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Button
                  key={item.href}
                  variant={isActive ? "default" : "ghost"}
                  className={cn("gap-2", !isActive && "text-muted-foreground")}
                  onClick={() => navigateWithDirtyCheck(item.href)}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
            {isViewer && (
              <Input
                value={viewerQuery}
                onChange={(event) => {
                  const params = new URLSearchParams(searchParams.toString());
                  const value = event.target.value;
                  if (value) params.set("q", value);
                  else params.delete("q");
                  const query = params.toString();
                  router.replace(query ? `/viewer?${query}` : "/viewer");
                }}
                placeholder="Search name or desk #"
                aria-label="Search desks"
                className="w-64"
              />
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>
      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full px-4 py-6 md:px-6 md:py-8"
      >
        {children}
      </motion.main>
    </div>
  );
}
