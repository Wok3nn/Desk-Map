"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutGrid, Settings, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/viewer", label: "Viewer", icon: LayoutGrid },
  { href: "/admin", label: "Admin Studio", icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewerQuery = searchParams.get("q") ?? "";
  const isViewer = pathname?.startsWith("/viewer");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="flex w-full items-center justify-between px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold tracking-tight">DeskMap</p>
              <p className="text-xs text-muted-foreground">Premium seating intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {navItems.map((item) => {
              const isActive = pathname?.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Button
                  key={item.href}
                  asChild
                  variant={isActive ? "default" : "ghost"}
                  className={cn("gap-2", !isActive && "text-muted-foreground")}
                >
                  <Link href={item.href}>
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
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
