import { prisma } from "./db";
import { runSeed } from "./seed-data";

// Seed perezoso: se ejecuta una sola vez por proceso del servidor,
// en el primer request a la API (runtime Node). Equivale a "seed al iniciar"
// sin depender de instrumentation.ts (que se bundlea también para edge).
// La promesa vive en globalThis porque Next puede instanciar el módulo por ruta.
const g = globalThis as unknown as { __eiraSeedPromise?: Promise<void> };

export function ensureSeeded(): Promise<void> {
  if (!g.__eiraSeedPromise) {
    g.__eiraSeedPromise = runSeed(prisma)
      .then(() => undefined)
      .catch((e) => {
        console.error("[seed] Error:", e);
        g.__eiraSeedPromise = undefined; // permite reintentar
      });
  }
  return g.__eiraSeedPromise;
}
