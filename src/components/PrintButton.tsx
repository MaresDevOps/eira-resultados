"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-primary mt-6 w-full">
      Imprimir / Guardar PDF
    </button>
  );
}
