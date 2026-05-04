import { requireEspacio } from "@/lib/espacio";
import { createClient } from "@/lib/supabase/server";
import { CategoriasClient } from "./categorias-client";

export default async function CategoriasPage({ params }: { params: { slug: string } }) {
  const espacio = await requireEspacio(params.slug);
  const supabase = createClient();
  const { data } = await supabase
    .from("categorias")
    .select("*")
    .eq("espacio_id", espacio.id)
    .order("tipo")
    .order("orden")
    .order("nombre");
  return <CategoriasClient espacioId={espacio.id} initial={data ?? []} />;
}
