import { redirect } from "next/navigation";
import { getMisEspacios } from "@/lib/espacio";

export default async function Home() {
  const espacios = await getMisEspacios();
  if (espacios.length === 0) redirect("/espacios");
  // Preferir empresarial primero, luego personal
  const empr = espacios.find((e) => e.tipo === "empresarial");
  redirect(`/e/${(empr ?? espacios[0]).slug}/dashboard`);
}
