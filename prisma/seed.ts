import { PrismaClient } from "@prisma/client";
import { runSeed } from "../src/lib/seed-data";

const prisma = new PrismaClient();

runSeed(prisma)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    // El seed abre una conexión ioredis a Valkey al crear tokens de demo;
    // sin exit explícito el proceso queda colgado y `npm run start` no corre.
    process.exit(0);
  });
