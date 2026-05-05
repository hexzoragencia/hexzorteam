import { requireEspacio } from "@/lib/espacio";
import { createClient } from "@/lib/supabase/server";
import { RecursosClient } from "./recursos-client";
import { redirect } from "next/navigation";

export default async function RecursosPage({ params }: { params: { slug: string } }) {
  const espacio = await requireEspacio(params.slug);
  if (espacio.tipo !== "empresarial") redirect(`/e/${espacio.slug}/dashboard`);

  const supabase = createClient();
  const { data } = await supabase.from("emp_recursos")
    .select("*").eq("espacio_id", espacio.id).order("categoria").order("created_at", { ascending: false });

  return <RecursosClient espacioId={espacio.id} initial={(data ?? []) as any} />;
}
