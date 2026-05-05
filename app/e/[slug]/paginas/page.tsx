import { requireEspacio } from "@/lib/espacio";
import { createClient } from "@/lib/supabase/server";
import { PaginasClient } from "./paginas-client";
import { redirect } from "next/navigation";

export default async function PaginasPage({ params }: { params: { slug: string } }) {
  const espacio = await requireEspacio(params.slug);
  if (espacio.tipo !== "empresarial") redirect(`/e/${espacio.slug}/dashboard`);

  const supabase = createClient();
  const { data } = await supabase.from("emp_paginas")
    .select("*").eq("espacio_id", espacio.id).order("pais").order("created_at", { ascending: false });

  return <PaginasClient espacioId={espacio.id} initial={(data ?? []) as any} />;
}
