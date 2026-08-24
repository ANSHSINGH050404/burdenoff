import type { Prisma, PrismaClient } from '@prisma/client';
import type { Database } from './user.repository';

export type HolidayRecord = Prisma.HolidayGetPayload<object>;

export const holidayRepository = {
  listAll(db: PrismaClient): Promise<HolidayRecord[]> {
    return db.holiday.findMany({ orderBy: { date: 'asc' } });
  },
  listAllInTx(db: Database): Promise<HolidayRecord[]> {
    return db.holiday.findMany();
  },
};
