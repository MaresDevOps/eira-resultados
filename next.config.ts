import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma e ioredis usan APIs de Node: se cargan como paquetes externos,
  // nunca se bundlean para el edge runtime.
  serverExternalPackages: ["@prisma/client", "prisma", "ioredis"],
  // Oculta el badge flotante de Next.js en modo dev (el "N" en la esquina).
  devIndicators: false,
};

export default nextConfig;
