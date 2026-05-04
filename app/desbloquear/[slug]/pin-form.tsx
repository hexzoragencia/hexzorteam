"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PinForm({ espacioId, slug }: { espacioId: string; slug: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);

    const { data, error: rpcErr } = await supabase.rpc("verificar_pin", {
      esp_id: espacioId, pin_intento: pin,
    });

    if (rpcErr) { setError(rpcErr.message); setLoading(false); return; }
    if (!data) { setError("PIN incorrecto"); setPin(""); setLoading(false); return; }

    const r = await fetch("/api/desbloquear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ espacioId }),
    });
    if (!r.ok) { setError("No se pudo guardar la sesión"); setLoading(false); return; }

    router.push(`/e/${slug}/dashboard`);
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="pin">PIN</Label>
        <Input
          id="pin"
          type="password"
          inputMode="numeric"
          pattern="\d*"
          autoFocus
          required
          minLength={4}
          maxLength={8}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          placeholder="••••"
          className="text-center text-2xl tracking-[0.5em] h-14"
        />
      </div>
      {error && <p className="text-sm text-destructive text-center">{error}</p>}
      <Button type="submit" disabled={loading || pin.length < 4} className="w-full">
        {loading ? "Verificando..." : "Desbloquear"}
      </Button>
    </form>
  );
}
