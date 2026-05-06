import { requireEspacio, getCurrentUser } from "@/lib/espacio";
import { createClient } from "@/lib/supabase/server";
import { EspacioClient } from "./espacio-client";

export default async function EspacioConfigPage({ params }: { params: { slug: string } }) {
  const espacio = await requireEspacio(params.slug);
  const user = await getCurrentUser();
  const supabase = createClient();

  // Cargar el alias actual del usuario en este espacio
  let aliasInicial: string | null = null;
  if (user) {
    const { data } = await supabase.from("espacio_miembros")
      .select("alias").eq("espacio_id", espacio.id).eq("perfil_id", user.id).maybeSingle();
    aliasInicial = data?.alias ?? null;
  }

  return <EspacioClient espacio={espacio} aliasInicial={aliasInicial} />;
}
