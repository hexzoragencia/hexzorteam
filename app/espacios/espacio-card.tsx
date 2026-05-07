"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, User, Lock, ArrowRight, Trash2, Loader2 } from "lucide-react";
import type { Espacio } from "@/lib/types";

export function EspacioCardCliente({
  espacio, tipo, esOwner,
}: {
  espacio: Espacio;
  tipo: "empresarial" | "personal";
  esOwner: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [borrando, setBorrando] = useState(false);

  async function eliminar(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const confirmacion = prompt(
      `Para eliminar "${espacio.nombre}" escribe el nombre exacto:\n\n${espacio.nombre}`
    );
    if (confirmacion !== espacio.nombre) {
      if (confirmacion !== null) alert("El nombre no coincide. No se eliminó.");
      return;
    }
    setBorrando(true);
    const { error } = await supabase.from("espacios").delete().eq("id", espacio.id);
    setBorrando(false);
    if (error) { alert(error.message); return; }
    router.refresh();
  }

  return (
    <div className="relative group">
      <Link href={`/e/${espacio.slug}/dashboard`} className="block">
        <Card className="hover:border-primary hover:shadow-md transition-all cursor-pointer h-full">
          <CardContent className="p-5 flex items-center gap-4">
            <div className={`shrink-0 rounded-lg p-3 ${tipo === "empresarial" ? "bg-primary/10 text-primary" : "bg-violet-500/10 text-violet-500"}`}>
              {tipo === "empresarial" ? <Building2 className="h-5 w-5" /> : <User className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold flex items-center gap-2 truncate">
                <span className="truncate">{espacio.nombre}</span>
                {espacio.pin_hash && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
              </div>
              <div className="text-xs text-muted-foreground">{tipo === "empresarial" ? "Empresarial" : "Personal"} · {espacio.moneda}</div>
            </div>
            {/* Espacio para que la papelera no se solape con la flecha */}
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition shrink-0 mr-6" />
          </CardContent>
        </Card>
      </Link>
      {/* Botón eliminar — solo visible si eres owner */}
      {esOwner && (
        <button
          type="button"
          onClick={eliminar}
          disabled={borrando}
          className="absolute top-1/2 right-3 -translate-y-1/2 p-2 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition opacity-50 group-hover:opacity-100"
          title={`Eliminar espacio "${espacio.nombre}"`}
        >
          {borrando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}
