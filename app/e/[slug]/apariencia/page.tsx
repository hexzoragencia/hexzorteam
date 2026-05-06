import { requireEspacio } from "@/lib/espacio";
import { getPreferenciasEspacio } from "@/lib/preferencias-server";
import { AparienciaClient } from "./apariencia-client";

export default async function AparienciaPage({ params }: { params: { slug: string } }) {
  const espacio = await requireEspacio(params.slug);
  const prefs = await getPreferenciasEspacio(espacio.id);
  return <AparienciaClient initial={prefs} espacioId={espacio.id} espacioNombre={espacio.nombre} />;
}
