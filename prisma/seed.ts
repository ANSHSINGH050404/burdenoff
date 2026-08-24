import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();
const hash = await bcrypt.hash('password', 12);

await db.user.upsert({
  where: { email: 'reporter@example.com' },
  update: {},
  create: {
    email: 'reporter@example.com',
    name: 'Demo Reporter',
    passwordHash: hash,
    role: Role.REPORTER,
  },
});
await db.user.upsert({
  where: { email: 'agent@example.com' },
  update: {},
  create: { email: 'agent@example.com', name: 'Demo Agent', passwordHash: hash, role: Role.AGENT },
});

const year = new Date().getFullYear() + 1;
const sampleHolidays = [
  { date: new Date(`${year}-01-26`), name: 'Republic Day' },
  { date: new Date(`${year}-08-15`), name: 'Independence Day' },
];
for (const holiday of sampleHolidays) {
  await db.holiday.upsert({
    where: { date: holiday.date },
    update: { name: holiday.name },
    create: holiday,
  });
}

await db.$disconnect();
