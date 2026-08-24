-- Application-level validation is mirrored with durable database constraints.
ALTER TABLE "Ticket" ADD CONSTRAINT "ticket_title_not_empty" CHECK (length("title") > 0);
ALTER TABLE "Ticket" ADD CONSTRAINT "ticket_description_not_empty" CHECK (length("description") > 0);
ALTER TABLE "Comment" ADD CONSTRAINT "comment_content_not_empty" CHECK (length("content") > 0);

-- A ticket may have at most one open (unresolved) resolution attempt.
CREATE UNIQUE INDEX "resolution_attempt_single_open_per_ticket"
  ON "ResolutionAttempt"("ticketId")
  WHERE "resolvedAt" IS NULL;
