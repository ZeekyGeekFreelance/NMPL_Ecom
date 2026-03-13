-- CreateIndex
CREATE INDEX "CartEvent_timestamp_idx" ON "public"."CartEvent"("timestamp");

-- CreateIndex
CREATE INDEX "Category_createdAt_idx" ON "public"."Category"("createdAt");

-- CreateIndex
CREATE INDEX "Category_name_idx" ON "public"."Category"("name");

-- CreateIndex
CREATE INDEX "Log_createdAt_idx" ON "public"."Log"("createdAt");

-- CreateIndex
CREATE INDEX "Report_createdAt_idx" ON "public"."Report"("createdAt");
