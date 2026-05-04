import { redirect } from "next/navigation";
import { requireEspacio } from "@/lib/espacio";
import { createClient } from "@/lib/supabase/server";
import { ConfiguracionClient } from "./configuracion-client";
import { DEFAULT_COUNTRIES } from "@/lib/calc";
import type { CountryConfig } from "@/lib/types";

export default async function ConfiguracionPage({ params }: { params: { slug: string } }) {
  const espacio = await requireEspacio(params.slug);
  if (espacio.tipo !== "empresarial") redirect(`/e/${espacio.slug}/dashboard`);

  const supabase = createClient();
  const { data } = await supabase.from("paises_config").select("*").order("code");
  const paises = (data && data.length > 0 ? data : DEFAULT_COUNTRIES) as CountryConfig[];
  return <ConfiguracionClient paises={paises} />;
}
