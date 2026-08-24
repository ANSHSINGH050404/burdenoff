/*
  Warnings:

  - You are about to drop the column `body` on the `Comment` table. All the data in the column will be lost.
  - Added the required column `content` to the `Comment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dueAt` to the `ResolutionAttempt` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Comment" DROP COLUMN "body",
ADD COLUMN     "content" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ResolutionAttempt" ADD COLUMN     "dueAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "state" "SlaState" NOT NULL DEFAULT 'ON_TRACK';
