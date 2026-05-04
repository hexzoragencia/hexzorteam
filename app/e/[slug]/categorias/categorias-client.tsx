"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORIA_TIPOS, type Categoria, type CategoriaTipo } from "@/lib/types";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";

export function CategoriasClient({
  espacioId, initial,
}: { espacioId: string; initial: Categoria[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [cats, setCats] = useState<Categoria[]>(initial);
  const [nuevoNombre, setNuevoNombre] = useState<Record<CategoriaTipo, string>>({
    ingreso: "", pago_programado: "", suscripcion: "", gasto_mensual: "", ahorro: "", deuda: "",
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const agregar = async (tipo: CategoriaTipo) => {
    const nombre = nuevoNombre[tipo].trim();
    if (!nombre) return;
    const { data, error } = await supabase.from("categorias").insert({
      espacio_id: espacioId, tipo, nombre,
    }).select().single();
    if (error) { alert(error.message); return; }
    setCats([...cats, data as Categoria]);
    setNuevoNombre({ ...nuevoNombre, [tipo]: "" });
    router.refresh();
  };

  const borrar = async (id: string) => {
    if (!confirm("¿Borrar esta categoría? Las transacciones quedarán sin categoría.")) return;
    const { error } = await supabase.from("categorias").delete().eq("id", id);
    if (!error) setCats(cats.filter((c) => c.id !== id));
    router.refresh();
  };

  const startEdit = (c: Categoria) => { setEditing(c.id); setEditValue(c.nombre); };
  const guardarEdit = async (id: string) => {
    const nombre = editValue.trim();
    if (!nombre) return;
    const { error } = await supabase.from("categorias").update({ nombre }).eq("id", id);
    if (!error) setCats(cats.map((c) => (c.id === id ? { ...c, nombre } : c)));
    setEditing(null);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Categorías</h1>
        <p className="text-muted-foreground">
          Define los conceptos por tipo. Estas categorías se usan en presupuesto y transacciones.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {CATEGORIA_TIPOS.map((t) => {
          const items = cats.filter((c) => c.tipo === t.value);
          return (
            <Card key={t.value}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <span>{t.emoji}</span> {t.label}
                  <span className="text-xs font-normal text-muted-foreground ml-auto">{items.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">Sin categorías. Agrega abajo.</p>
                )}
                {items.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 rounded border p-2 text-sm">
                    {editing === c.id ? (
                      <>
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && guardarEdit(c.id)}
                          className="h-8"
                        />
                        <Button size="icon" variant="ghost" onClick={() => guardarEdit(c.id)} className="h-8 w-8 shrink-0">
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditing(null)} className="h-8 w-8 shrink-0">
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 truncate font-medium">{c.nombre}</span>
                        <Button size="icon" variant="ghost" onClick={() => startEdit(c)} className="h-8 w-8">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => borrar(c.id)} className="h-8 w-8">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <Input
                    placeholder={`Nueva ${t.label.toLowerCase()}...`}
                    value={nuevoNombre[t.value]}
                    onChange={(e) => setNuevoNombre({ ...nuevoNombre, [t.value]: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && agregar(t.value)}
                  />
                  <Button onClick={() => agregar(t.value)} size="icon" className="shrink-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
