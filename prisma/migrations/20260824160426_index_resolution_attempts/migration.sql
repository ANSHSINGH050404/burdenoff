-- CreateIndex
CREATE INDEX "ResolutionAttempt_ticketId_startedAt_idx" ON "ResolutionAttempt"("ticketId", "startedAt");
