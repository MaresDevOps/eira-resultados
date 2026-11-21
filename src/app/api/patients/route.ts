import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureSeeded } from "@/lib/ensure-seed";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Búsqueda de pacientes por nombre y/o fecha de nacimiento o CURP.
// Devuelve matches con flag de "homónimo posible" para forzar verificación.
export async function GET(req: NextRequest) {
  const auth = await requireSession(req);
  if (auth.response) return auth.response;
  await ensureSeeded();
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ patients: [] });

  const [nombre, ...resto] = q.split("|").map((s) => s.trim());
  const extra = resto[0] ?? "";

  const patients = await prisma.patient.findMany({
    where: {
      OR: [
        { nombreCompleto: { contains: nombre } },
        { curp: { contains: q.toUpperCase() } },
        ...(extra ? [{ fechaNacimiento: extra }, { telefono: { contains: extra } }] : []),
      ],
    },
    include: { studies: { select: { id: true, estado: true, fechaToma: true } } },
    take: 10,
    orderBy: { nombreCompleto: "asc" },
  });

  // Detectar posibles homónimos: mismo nombre, distinta fecha/CURP
  const counts = new Map<string, number>();
  for (const p of patients) {
    const key = p.nombreCompleto.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return NextResponse.json({
    patients: patients.map((p) => ({
      ...p,
      posibleHomónimo: (counts.get(p.nombreCompleto.toLowerCase()) ?? 0) > 1,
    })),
  });
}
