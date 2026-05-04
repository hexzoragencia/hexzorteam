import { requireEspacio } from "@/lib/espacio";
import { createClient } from "@/lib/supabase/server";
import { FondosClient } from "./fondos-client";
import type { FondoReserva } from "@/lib/types";

export default async function FondosPage({ params }: { params: { slug: string } }) {
  const espacio = await requireEspacio(params.slug);
  const supabase = createClient();
  const { data } = await supabase
    .from("fondos_reserva")
    .select("*")
    .eq("espacio_id", espacio.id)
    .order("created_at", { ascending: true });
  return <FondosClient espacio={espacio} initial={(data ?? []) as FondoReserva[]} />;
}
