import { requireEspacio } from "@/lib/espacio";
import { createClient } from "@/lib/supabase/server";
import { AccesosClient } from "./accesos-client";
import { redirect } from "next/navigation";

export default async function AccesosPage({ params }: { params: { slug: string } }) {
  const espacio = await requireEspacio(params.slug);
  if (espacio.tipo !== "empresarial") redirect(`/e/${espacio.slug}/dashboard`);

  // Verificar que el usuario es owner del espacio (la RLS lo filtra igual,
  // pero así mostramos un mensaje claro si no es owner).
  const supabase = createClient();
  const { data: miembro } = await supabase
    .from("espacio_miembros").select("rol")
    .eq("espacio_id", espacio.id)
    .eq("perfil_id", (await supabase.auth.getUser()).data.user?.id ?? "")
    .maybeSingle();
  const esOwner = miembro?.rol === "owner";

  const { data } = await supabase.from("emp_accesos")
    .select("*").eq("espacio_id", espacio.id).order("plataforma").order("created_at", { ascending: false });

  return <AccesosClient espacioId={espacio.id} initial={(data ?? []) as any} esOwner={esOwner} />;
}
