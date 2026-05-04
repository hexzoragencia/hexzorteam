import { requireEspacio, getMisEspacios } from "@/lib/espacio";
import { Nav } from "@/components/nav";
import { createClient } from "@/lib/supabase/server";

export default async function EspacioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const espacio = await requireEspacio(params.slug);
  const espacios = await getMisEspacios();

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen">
      <Nav espacioActual={espacio} espacios={espacios} userEmail={user?.email} />
      <main className="md:pl-64">
        <div className="p-4 md:p-8 max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
