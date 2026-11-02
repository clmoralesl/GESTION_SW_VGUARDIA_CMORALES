import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { ImportacionesService } from '../src/importaciones/importaciones.service';
import { Reloj } from '../src/comun/reloj/reloj';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { RecalculoService } from '../src/recalculo/recalculo.service';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://autofix:autofix@localhost:5432/autofix';
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  await prisma.$connect();
  const reloj = new Reloj();
  const importaciones = new ImportacionesService(
    prisma as unknown as PrismaService,
    null as unknown as RecalculoService,
    reloj,
  );
  try {
    const { buffer } = await importaciones.exportarProyecto(1);
    const rutaDestino = resolve(__dirname, '../../../docs/caso_prueba.xlsx');
    writeFileSync(rutaDestino, buffer);
    console.log(`Archivo generado en: ${rutaDestino}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
