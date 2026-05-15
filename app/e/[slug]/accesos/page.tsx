import { requireEspacio, getVaultState } from "@/lib/espacio";
import { createClient } from "@/lib/supabase/server";
import { AccesosClient } from "./accesos-client";
import { VaultSetup } from "./vault-setup";
import { VaultUnlock } from "./vault-unlock";
import { redirect } from "next/navigation";

export default async function AccesosPage({ params }: { params: { slug: string } }) {
  const espacio = await requireEspacio(params.slug);
  if (espacio.tipo !== "empresarial") redirect(`/e/${espacio.slug}/dashboard`);

  const vault = await getVaultState(espacio.id);

  if (vault.state === "unconfigured") {
    return <VaultSetup espacioId={espacio.id} slug={espacio.slug} esOwner={vault.esOwner} />;
  }
  if (vault.state === "locked") {
    return <VaultUnlock espacioId={espacio.id} slug={espacio.slug} esOwner={vault.esOwner} />;
  }

  // Unlocked — trae la lista sin la password (la pediremos on-demand).
  const supabase = createClient();
  const { data } = await supabase.from("emp_accesos")
    .select("id, espacio_id, categoria, plataforma, etiqueta, persona, usuario, url, notas, favorito, updated_at")
    .eq("espacio_id", espacio.id)
    .order("favorito", { ascending: false })
    .order("categoria", { ascending: true })
    .order("updated_at", { ascending: false });

  return (
    <AccesosClient
      espacioId={espacio.id}
      slug={espacio.slug}
      initial={(data ?? []) as any}
      esOwner={vault.esOwner}
    />
  );
}
