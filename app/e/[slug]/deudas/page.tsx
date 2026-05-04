import { requireEspacio } from "@/lib/espacio";
import { createClient } from "@/lib/supabase/server";
import { DeudasClient } from "./deudas-client";
import type { Deuda, SnowballConfig } from "@/lib/types";

export default async function DeudasPage({ params }: { params: { slug: string } }) {
  const espacio = await requireEspacio(params.slug);
  const supabase = createClient();
  const [{ data: deudas }, { data: cfg }] = await Promise.all([
    supabase.from("deudas").select("*").eq("espacio_id", espacio.id).order("balance", { ascending: true }),
    supabase.from("snowball_config").select("*").eq("espacio_id", espacio.id).maybeSingle(),
  ]);
  return <DeudasClient espacio={espacio} initialDeudas={(deudas ?? []) as Deuda[]} initialConfig={(cfg ?? null) as SnowballConfig | null} />;
}
