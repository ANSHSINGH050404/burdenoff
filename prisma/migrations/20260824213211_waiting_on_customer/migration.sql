-- AlterEnum
ALTER TYPE "TicketStatus" ADD VALUE 'WAITING_ON_CUSTOMER';

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "pausedAt" TIMESTAMP(3);
