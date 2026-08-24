import type { PrismaClient } from '@prisma/client';
import { businessTimezone } from '../../config';
import { holidayRepository } from '../../repositories/holiday.repository';
import type { Database } from '../../repositories/user.repository';
import { localDate } from '../sla/engine';

export function holidayDates(db: Database): Promise<Set<string>> {
  return holidayRepository
    .listAllInTx(db)
    .then((rows) => new Set(rows.map((row) => localDate(row.date, businessTimezone()))));
}

export function listHolidays(db: PrismaClient) {
  return holidayRepository.listAll(db);
}
