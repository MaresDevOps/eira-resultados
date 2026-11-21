// Generador de PDF mínimo válido (PDF 1.4) sin dependencias externas.
// Sirve para PDFs sintéticos de prueba y para el seed.

function escapePdfText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function buildSimplePdf(lines: string[]): Buffer {
  const content = [
    "BT",
    "/F1 16 Tf",
    "50 780 Td",
    `(EIRA Movimiento Rosa A.C. - Resultado de Estudio) Tj`,
    "0 -28 Td",
    "/F1 11 Tf",
    ...lines.map((l, i) => `${i === 0 ? "" : "0 -18 Td"}(${escapePdfText(l)}) Tj`),
    "ET",
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefPos = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}

// ---------- Reporte sintético con estructura de resultado real ----------
export interface ResultPdfMeta {
  folio?: string;
  paciente?: string;
  curp?: string;
  fechaNacimiento?: string;
  municipio?: string;
  fechaToma?: string;
  sede?: string;
  sha256?: string;
}

// Genera un PDF de resultado con estructura realista para la demo:
// encabezado institucional, datos de la paciente, datos del estudio,
// resultado, recomendaciones, sello de integridad y firma.
export function buildResultPdf(m: ResultPdfMeta): Buffer {
  const ops: string[] = [];
  let y = 765;
  const line = (txt: string, size = 10, gap = 14, indent = 0) => {
    ops.push(`/F1 ${size} Tf`, `0 -${gap} Td`, `${indent} 0 Td`, `(${escapePdfText(txt)}) Tj`, `-${indent} 0 Td`);
    y -= gap;
  };
  const seccion = (t: string) => {
    ops.push(`/F1 12 Tf`, `0 -18 Td`, `(${escapePdfText(t)}) Tj`);
    ops.push(`1 w`, `50 ${(y - 22).toFixed(0)} m 562 ${(y - 22).toFixed(0)} l S`);
    y -= 24;
  };

  ops.push("BT", "/F1 15 Tf", "50 780 Td");
  ops.push(`(EIRA Movimiento Rosa A.C.) Tj`);
  ops.push(`/F1 9 Tf`, `400 0 Td`, `(Programa Tamizaje Rosa) Tj`, `-400 0 Td`);
  y = 780;
  line("RESULTADO DE ESTUDIO - CITOLOGIA CERVICAL (PAPANICOLAOU)", 11, 18);
  line(`Folio: ${m.folio ?? "EIRA-XXXX-XXXX"}   |   Fecha de emision: ${new Date().toISOString().slice(0, 10)}`, 9, 12);
  line("Ciudad Guzman, Jalisco - Mexico", 9, 12);

  seccion("DATOS DE LA PACIENTE");
  line(`Nombre: ${m.paciente ?? "PACIENTE DE PRUEBA"}`, 10);
  line(`CURP: ${m.curp ?? "XXXXXXXXXXXXXXXXXX"}      Fecha de nacimiento: ${m.fechaNacimiento ?? "---- -- --"}`, 10);
  line(`Municipio: ${m.municipio ?? "Ciudad Guzman, Jalisco"}`, 10);

  seccion("DATOS DEL ESTUDIO");
  line(`Tipo de estudio: Citologia cervical - Papanicolaou`, 10);
  line(`Fecha de toma de muestra: ${m.fechaToma ?? new Date().toISOString().slice(0, 10)}`, 10);
  line(`Sede de atencion: ${m.sede ?? "Sede EIRA"}`, 10);
  line("Laboratorio procesante: Laboratorio de citologia convenio EIRA (ficticio)", 10);
  line("Tecnica: Citologia convencional - tincion de Papanicolaou", 10);

  seccion("RESULTADO");
  line("Calidad de la muestra: Muestra satisfactoria para evaluacion.", 10);
  line("Resultado citologico: Negativo para lesion intraepitelial o malignidad (ficticio).", 10);
  line("Flora vaginal: Bacilos de Doderlein predominantes. Sin hallazgos de alarma.", 10);
  line("Observaciones: Epitelio escamoso normal. Consultar siempre con la medica tratante.", 10);

  seccion("RECOMENDACIONES");
  line("- Agenda tu consulta de seguimiento para revisar este resultado con una medica.", 10);
  line("- Si presentas sintomas (sangrado anormal, dolor), acude a tu unidad de salud.", 10);
  line("- Manten tu tamizaje al dia conforme a la norma oficial mexicana NOM-014-SSA2.", 10);

  seccion("SELLO DE INTEGRIDAD Y TRAZABILIDAD");
  line(`SHA-256 del documento: ${m.sha256 ?? "(se calcula al cargar)"}`, 9);
  line("Este documento fue entregado por el canal digital seguro de EIRA.", 9);
  line("Verificacion en: plataforma EIRA (folio + identidad de la paciente).", 9);

  ops.push(`/F1 10 Tf`, `0 -26 Td`, `(______________________________) Tj`);
  ops.push(`/F1 9 Tf`, `0 -14 Td`, `(Medica responsable - Ced. Prof. XXXXXXX (ficticia)) Tj`);
  ops.push(`/F1 8 Tf`, `0 -24 Td`, `(DOCUMENTO SINTETICO DE DEMOSTRACION - NO ES UN REPORTE CLINICO REAL.) Tj`);
  ops.push(`0 -12 Td`, `(Todos los datos son ficticios. Uso exclusivo para desarrollo y demostracion.) Tj`);

  const content = ops.join("\n") + "\nET";

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefPos = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}
