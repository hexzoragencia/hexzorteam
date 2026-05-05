import { requireEspacio } from "@/lib/espacio";
import { createClient } from "@/lib/supabase/server";
import { ProyeccionClient } from "./proyeccion-client";
import { redirect } from "next/navigation";

export default async function ProyeccionPage({ params }: { params: { slug: string } }) {
  const espacio = await requireEspacio(params.slug);
  if (espacio.tipo !== "empresarial") redirect(`/e/${espacio.slug}/dashboard`);

  const supabase = createClient();
  const [{ data: meta }, { data: tracking }] = await Promise.all([
    supabase.from("emp_metas").select("*").eq("espacio_id", espacio.id).maybeSingle(),
    supabase.from("emp_metas_tracking").select("*").eq("espacio_id", espacio.id).order("fecha", { ascending: false }).limit(60),
  ]);

  return (
    <ProyeccionClient
      espacioId={espacio.id}
      moneda={espacio.moneda}
      meta={meta as any}
      tracking={(tracking ?? []) as any}
    />
  );
}
