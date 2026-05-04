import { requireEspacio } from "@/lib/espacio";
import { getPreferenciasUsuario } from "@/lib/preferencias-server";
import { AparienciaClient } from "./apariencia-client";

export default async function AparienciaPage({ params }: { params: { slug: string } }) {
  await requireEspacio(params.slug);
  const prefs = await getPreferenciasUsuario();
  return <AparienciaClient initial={prefs} />;
}
