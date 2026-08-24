-- AlterEnum
ALTER TYPE "EventType" ADD VALUE 'ASSIGNED';

-- AlterTable
ALTER TABLE "TicketEvent" ADD COLUMN     "fromAssigneeId" TEXT,
ADD COLUMN     "toAssigneeId" TEXT;
