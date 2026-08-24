/*
  Warnings:

  - You are about to drop the column `firstRespondedAt` on the `Ticket` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('URGENT', 'HIGH', 'MEDIUM', 'LOW');

-- AlterTable
ALTER TABLE "Ticket" DROP COLUMN "firstRespondedAt",
ADD COLUMN     "firstResponseAt" TIMESTAMP(3),
ADD COLUMN     "priority" "Priority" NOT NULL DEFAULT 'MEDIUM';

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comment_ticketId_createdAt_idx" ON "Comment"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_priority_idx" ON "Ticket"("priority");

-- CreateIndex
CREATE INDEX "Ticket_assigneeId_idx" ON "Ticket"("assigneeId");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
