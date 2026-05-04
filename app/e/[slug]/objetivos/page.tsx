import { requireEspacio } from "@/lib/espacio";
import { createClient } from "@/lib/supabase/server";
import { ObjetivosClient } from "./objetivos-client";
import type { Objetivo, ObjetivoSubtarea } from "@/lib/types";

export default async function ObjetivosPage({ params }: { params: { slug: string } }) {
  const espacio = await requireEspacio(params.slug);
  const supabase = createClient();
  const { data: objetivos } = await supabase
    .from("objetivos")
    .select("*")
    .eq("espacio_id", espacio.id)
    .order("estado")
    .order("orden")
    .order("created_at");

  const ids = (objetivos ?? []).map((o: any) => o.id);
  let subtareas: ObjetivoSubtarea[] = [];
  if (ids.length > 0) {
    const { data } = await supabase.from("objetivo_subtareas").select("*").in("objetivo_id", ids).order("orden");
    subtareas = (data ?? []) as ObjetivoSubtarea[];
  }

  return (
    <ObjetivosClient
      espacio={espacio}
      initialObjetivos={(objetivos ?? []) as Objetivo[]}
      initialSubtareas={subtareas}
    />
  );
}
