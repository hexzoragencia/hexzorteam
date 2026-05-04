"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Receipt, Wallet, Tags, PiggyBank, CreditCard,
  Calculator, Settings, LogOut, Menu, X, ChevronDown, Building2, User, Lock, Plus,
} from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Espacio } from "@/lib/types";

const ICONS: Record<string, any> = {
  LayoutDashboard, Receipt, Wallet, Tags, PiggyBank, CreditCard, Calculator, Settings,
};

const ITEMS = (tipo: "empresarial" | "personal") => {
  const base = [
    { href: "dashboard",     label: "Dashboard",     icon: "LayoutDashboard" },
    { href: "transacciones", label: "Transacciones", icon: "Receipt" },
    { href: "presupuesto",   label: "Presupuesto",   icon: "Wallet" },
    { href: "categorias",    label: "Categorías",    icon: "Tags" },
    { href: "fondos",        label: "Fondos",        icon: "PiggyBank" },
    { href: "deudas",        label: "Deudas",        icon: "CreditCard" },
  ];
  if (tipo === "empresarial") {
    base.push({ href: "calculadora",   label: "Calculadora",   icon: "Calculator" });
    base.push({ href: "configuracion", label: "Configuración", icon: "Settings" });
  }
  return base;
};

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
  const supabase = createClient();

  const items = ITEMS(espacioActual.tipo);

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const SidebarContent = (
    <>
      <div className="hidden md:flex h-16 items-center gap-3 px-5 border-b">
        <Image src="/icon.svg" alt="Hexzor" width={32} height={32} priority />
        <div className="flex flex-col leading-tight">
          <span className="font-bold text-base tracking-tight">Hexzor</span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-widest">Empresarial</span>
        </div>
      </div>

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

      <nav className="p-3 space-y-1">
        {items.map((l) => {
          const href = `/e/${espacioActual.slug}/${l.href}`;
          const active = pathname === href || pathname.startsWith(href + "/");
          const Icon = ICONS[l.icon];
          return (
            <Link
              key={l.href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-primary text-primary-foreground brand-glow" : "hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-0 inset-x-0 p-3 border-t bg-card">
        {userEmail && <p className="text-xs text-muted-foreground truncate mb-2 px-2">{userEmail}</p>}
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
          <Image src="/icon.svg" alt="Hexzor" width={26} height={26} priority />
          <span className="font-bold tracking-tight truncate max-w-[160px]">{espacioActual.nombre}</span>
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </header>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-64 border-r bg-card transition-transform md:translate-x-0",
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
