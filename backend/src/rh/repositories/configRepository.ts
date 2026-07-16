import { prisma } from '../../config/prisma.js';

export async function getConfig(key: string) {
  const row = await prisma.rhConfig.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setConfig(key: string, value: string) {
  await prisma.rhConfig.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}
