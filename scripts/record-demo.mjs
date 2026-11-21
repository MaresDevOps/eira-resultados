// Graba un video .webm del flujo demo en Chrome real (sin descargar Chromium).
// Uso: node scripts/record-demo.mjs
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "demo-video";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1360, height: 820 },
  recordVideo: { dir: OUT, size: { width: 1360, height: 820 } },
  locale: "es-MX",
});
const page = await ctx.newPage();
const slow = (ms) => page.waitForTimeout(ms);

console.log("-> /login");
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await slow(2500);

// Login 1-clic como Médico (para autorizar)
console.log("-> login demo MEDICO");
await page.getByText("Dra. Martínez / Médico").click();
await page.waitForURL(`${BASE}/`, { timeout: 15000 });
await slow(2500);

// Autorizar el estudio de Ana Ejemplo
console.log("-> autorizar estudio (Ana Ejemplo)");
const card = page.locator("div.rounded-2xl.border-2", { hasText: "Ana Ejemplo" }).first();
await card.scrollIntoViewIfNeeded();
await slow(1500);
await card.getByText("Autorizar Entrega Digital").click();
await slow(2000);

// Notificar -> aparece tarjeta SMS + QR
console.log("-> notificar (SMS + QR)");
await page.getByText("Enviar notificación (simulada)").first().click();
await slow(2000);
await page.locator("text=Simulador de Bandeja SMS / Correo").first().scrollIntoViewIfNeeded();
await slow(3000);

// Copiar enlace
const link = await page.locator('a[href*="/acceso/"]').first().getAttribute("href");
console.log("   link paciente:", link);

// Bandeja SMS con QR por mensaje
console.log("-> vista Bandeja SMS");
await page.getByRole("button", { name: "Simulador SMS / Correo" }).click();
await slow(3000);

// Bitácora
console.log("-> vista Bitácora");
await page.getByRole("button", { name: "Bitácora de Auditoría" }).click();
await slow(3000);

// Vista paciente en el link temporal
if (link) {
  console.log("-> vista paciente", link);
  const mob = await ctx.newPage();
  await mob.setViewportSize({ width: 420, height: 800 });
  await mob.goto(link.startsWith("http") ? link : `${BASE}${link}`, { waitUntil: "networkidle" });
  await slow(2500);
  await mob.close();
}

// Panel de nuevo + logout
await page.getByRole("button", { name: "Panel operativo" }).click();
await slow(1500);
await page.getByRole("button", { name: "Cerrar sesión" }).click();
await slow(2000);

await ctx.close(); // <- aquí se materializa el video
await browser.close();
console.log("Video listo en ./demo-video/");
