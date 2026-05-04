import { requireEspacio } from "@/lib/espacio";
import { EspacioClient } from "./espacio-client";

export default async function EspacioConfigPage({ params }: { params: { slug: string } }) {
  const espacio = await requireEspacio(params.slug);
  return <EspacioClient espacio={espacio} />;
}
