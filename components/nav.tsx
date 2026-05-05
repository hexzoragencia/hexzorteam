"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Receipt, Wallet, Tags, PiggyBank, CreditCard,
  Calculator, Settings, LogOut, Menu, X, ChevronDown, ChevronRight, ChevronLeft,
  Building2, User, Lock, Plus, BookOpenCheck, Palette, Sparkles, Rocket, Target, CalendarDays,
  Package, TrendingUp, Briefcase,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Espacio } from "@/lib/types";

const ICONS: Record<string, any> = {
  LayoutDashboard, Receipt, Wallet, Tags, PiggyBank, CreditCard, Calculator, Settings, BookOpenCheck, Palette, Sparkles, Rocket, Target, CalendarDays, Building2, Package, TrendingUp, Briefcase,
};

type NavItem = { href: string; label: string; icon: string };
type NavGroup = { id: string; label: string; icon: string; items: NavItem[] };
type NavEntry = { kind: "item"; item: NavItem } | { kind: "group"; group: NavGroup };

function buildNav(tipo: "empresarial" | "personal"): NavEntry[] {
  const dashboard: NavEntry = { kind: "item", item: { href: "dashboard", label: "Dashboard", icon: "LayoutDashboard" } };

  const contabilidad: NavGroup = {
    id: "contabilidad",
    label: "Contabilidad",
    icon: "BookOpenCheck",
    items: [
      { href: "transacciones", label: "Transacciones", icon: "Receipt" },
      { href: "presupuesto",   label: "Presupuesto",   icon: "Wallet" },
      { href: "categorias",    label: "Categorías",    icon: "Tags" },
      { href: "fondos",        label: "Fondos",        icon: "PiggyBank" },
      { href: "deudas",        label: "Deudas",        icon: "CreditCard" },
    ],
  };

  const ajustesItems: NavItem[] = [
    { href: "espacio",    label: "Datos del espacio", icon: "Building2" },
    { href: "apariencia", label: "Apariencia", icon: "Palette" },
  ];
  if (tipo === "empresarial") {
    ajustesItems.push({ href: "configuracion", label: "Calculadora config", icon: "Settings" });
  }
  const ajustes: NavGroup = { id: "ajustes", label: "Ajustes", icon: "Settings", items: ajustesItems };

  const productividad: NavGroup = {
    id: "productividad",
    label: "Productividad",
    icon: "Rocket",
    items: [
      { href: "planeacion", label: "Planeación", icon: "CalendarDays" },
      { href: "habitos",    label: "Hábitos",    icon: "Sparkles" },
      { href: "objetivos",  label: "Objetivos",  icon: "Target" },
    ],
  };

  const operacion: NavGroup = {
    id: "operacion",
    label: "Operación",
    icon: "Briefcase",
    items: [
      { href: "productos",  label: "Productos",         icon: "Package" },
      { href: "campanas",   label: "Campañas ADS",      icon: "TrendingUp" },
      { href: "proyeccion", label: "Proyección & Metas", icon: "Target" },
    ],
  };

  const entries: NavEntry[] = [dashboard, { kind: "group", group: contabilidad }];

  if (tipo === "personal") {
    entries.push({ kind: "group", group: productividad });
  }

  if (tipo === "empresarial") {
    entries.push({ kind: "group", group: operacion });
    entries.push({ kind: "item", item: { href: "calculadora", label: "Calculadora", icon: "Calculator" } });
  }

  entries.push({ kind: "group", group: ajustes });
  return entries;
}

export function Nav({
  espacioActual, espacios, userEmail,
}: {
  espacioActual: Espacio;
  espacios: Espacio[];
  userEmail?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);
  const supabase = createClient();

  const entries = buildNav(espacioActual.tipo);

  // Hidratar estado de colapsado desde localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("nav-collapsed");
      if (raw) setCollapsed(JSON.parse(raw));
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  // Persistir cambios
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem("nav-collapsed", JSON.stringify(collapsed)); } catch { /* ignore */ }
  }, [collapsed, hydrated]);

  function toggle(id: string) {
    setCollapsed(c => ({ ...c, [id]: !c[id] }));
  }

  // Un grupo está abierto si NO está colapsado, o si tiene un item activo (auto-expandir)
  function isGroupOpen(g: NavGroup) {
    const hasActive = g.items.some(it => {
      const href = `/e/${espacioActual.slug}/${it.href}`;
      return pathname === href || pathname.startsWith(href + "/");
    });
    if (hasActive) return true;
    return !collapsed[g.id];
  }

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const renderItem = (it: NavItem, depth = 0) => {
    const href = `/e/${espacioActual.slug}/${it.href}`;
    const active = pathname === href || pathname.startsWith(href + "/");
    const Icon = ICONS[it.icon];
    return (
      <Link
        key={it.href}
        href={href}
        onClick={() => setOpen(false)}
        className={cn(
          "flex items-center gap-3 rounded-md text-sm font-medium transition-colors",
          depth === 0 ? "px-3 py-2.5" : "pl-9 pr-3 py-2",
          active ? "bg-primary text-primary-foreground brand-glow" : "hover:bg-accent hover:text-accent-foreground"
        )}
      >
        <Icon className={cn(depth === 0 ? "h-4 w-4" : "h-3.5 w-3.5")} />
        {it.label}
      </Link>
    );
  };

  const SidebarContent = (
    <>
      <Link
        href={`/e/${espacioActual.slug}/dashboard`}
        onClick={() => setOpen(false)}
        className="hidden md:flex h-16 items-center gap-3 px-5 border-b hover:bg-accent transition-colors"
      >
        <Image src="/icon.jpg" alt="Hexzor" width={32} height={32} priority />
        <div className="flex flex-col leading-tight">
          <span className="font-bold text-base tracking-tight">Hexzor</span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-widest">Empresarial</span>
        </div>
      </Link>

      {/* Espacio switcher */}
      <div className="p-3 border-b">
        <button
          onClick={() => setSwitcherOpen(!switcherOpen)}
          className="w-full flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:border-primary transition-colors"
        >
          <span className="flex items-center gap-2 truncate">
            {espacioActual.tipo === "empresarial"
              ? <Building2 className="h-4 w-4 text-primary shrink-0" />
              : <User className="h-4 w-4 text-primary shrink-0" />}
            <span className="truncate font-medium">{espacioActual.nombre}</span>
            {espacioActual.tipo === "personal" && espacioActual.pin_hash && <Lock className="h-3 w-3 text-muted-foreground" />}
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", switcherOpen && "rotate-180")} />
        </button>
        {switcherOpen && (
          <div className="mt-2 space-y-1 rounded-md border bg-background p-1">
            {espacios.map((e) => (
              <Link
                key={e.id}
                href={`/e/${e.slug}/dashboard`}
                onClick={() => { setSwitcherOpen(false); setOpen(false); }}
                className={cn(
                  "flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent",
                  e.id === espacioActual.id && "bg-accent text-accent-foreground"
                )}
              >
                {e.tipo === "empresarial" ? <Building2 className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                <span className="truncate">{e.nombre}</span>
                {e.tipo === "personal" && e.pin_hash && <Lock className="h-3 w-3 text-muted-foreground ml-auto" />}
              </Link>
            ))}
            <Link
              href="/espacios/nuevo"
              onClick={() => { setSwitcherOpen(false); setOpen(false); }}
              className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent border-t mt-1 pt-2"
            >
              <Plus className="h-3.5 w-3.5" /> Nuevo espacio
            </Link>
          </div>
        )}
      </div>

      <nav className="p-3 space-y-1 overflow-y-auto pb-24">
        {entries.map((entry, idx) => {
          if (entry.kind === "item") return renderItem(entry.item);

          const g = entry.group;
          const GroupIcon = ICONS[g.icon];
          const isOpen = isGroupOpen(g);
          return (
            <div key={g.id} className="space-y-1">
              <button
                onClick={() => toggle(g.id)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors text-[11px]"
                )}
              >
                <GroupIcon className="h-4 w-4" />
                <span className="flex-1 text-left">{g.label}</span>
                {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
              {isOpen && (
                <div className="space-y-0.5">
                  {g.items.map(it => renderItem(it, 1))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="absolute bottom-0 inset-x-0 p-3 border-t bg-card space-y-2">
        {userEmail && <p className="text-xs text-muted-foreground truncate px-2">{userEmail}</p>}
        <Link
          href="/espacios"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Mis espacios
        </Link>
        <Button variant="outline" className="w-full justify-start gap-2" onClick={logout}>
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </Button>
      </div>
    </>
  );

  return (
    <>
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between border-b bg-background/80 backdrop-blur px-4 h-14">
        <Link href={`/e/${espacioActual.slug}/dashboard`} className="flex items-center gap-2">
          <Image src="/icon.jpg" alt="Hexzor" width={26} height={26} priority />
          <span className="font-bold tracking-tight truncate max-w-[160px]">{espacioActual.nombre}</span>
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </header>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-64 border-r bg-card transition-transform md:translate-x-0 flex flex-col",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          "pt-14 md:pt-0"
        )}
      >
        {SidebarContent}
      </aside>

      {open && (
        <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setOpen(false)} />
      )}
    </>
  );
}
