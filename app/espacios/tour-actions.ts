"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function marcarTourCompletado() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("perfiles").update({ tour_completado: true }).eq("id", user.id);
}

export async function reiniciarTour() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("perfiles").update({ tour_completado: false }).eq("id", user.id);
  revalidatePath("/espacios");
}
