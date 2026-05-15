import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { VAULT_COOKIE } from "@/lib/vault";

export async function POST(request: Request) {
  const { espacioId } = await request.json();
  if (!espacioId) return NextResponse.json({ error: "espacioId requerido" }, { status: 400 });
  cookies().set({
    name: VAULT_COOKIE(espacioId),
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return NextResponse.json({ ok: true });
}
