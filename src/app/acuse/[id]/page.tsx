import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function AcusePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const receipt = await prisma.receipt.findUnique({ where: { studyId: id } });
  if (!receipt) notFound();
  const study = await prisma.study.findUnique({ where: { id }, include: { patient: true } });
  if (!study) notFound();

  return (
    <div className="mx-auto max-w-lg p-6">
      <div className="rounded-2xl border-4 border-double border-[var(--rosa)] p-8 text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-[var(--rosa)]">EIRA Movimiento Rosa A.C.</p>
        <h1 className="mt-2 text-3xl font-black">ACUSE DE ENTREGA</h1>
        <p className="mt-1 text-slate-500">Entrega física / lectura asistida en sede</p>

        <div className="mt-6 space-y-2 text-left text-lg">
          <p><b>Paciente:</b> {study.patient.nombreCompleto}</p>
          <p><b>Fecha de nacimiento:</b> {study.patient.fechaNacimiento}</p>
          <p><b>Estudio:</b> Resultado de Papanicolaou</p>
          <p><b>Fecha de toma de muestra:</b> {study.fechaToma}</p>
          <p><b>Sede de entrega:</b> {receipt.sede}</p>
          <p><b>Fecha y hora de entrega:</b> {receipt.deliveredAt.toLocaleString("es-MX")}</p>
          <p><b>Entregó:</b> {receipt.deliveredBy}</p>
          {receipt.observations && <p><b>Observaciones:</b> {receipt.observations}</p>}
        </div>

        <p className="mt-6 text-sm text-slate-500">
          Declaro que recibí mi resultado de estudio de forma asistida en sede,
          con explicación de su contenido por parte del personal de EIRA.
        </p>
        <div className="mt-10 border-t border-slate-300 pt-4 text-sm text-slate-500">
          <p>Acuse #{receipt.id} · Documento sintético de demostración</p>
        </div>
      </div>
      <PrintButton />
    </div>
  );
}
