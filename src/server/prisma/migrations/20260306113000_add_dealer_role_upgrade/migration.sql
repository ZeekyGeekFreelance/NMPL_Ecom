-- Add DEALER to the ROLE enum.
-- This statement must be committed on its own before any DML that references
-- the new value can run (PostgreSQL restriction on enum additions within a
-- transaction).  The data-backfill UPDATEs live in the next migration.
ALTER TYPE "ROLE" ADD VALUE IF NOT EXISTS 'DEALER';
