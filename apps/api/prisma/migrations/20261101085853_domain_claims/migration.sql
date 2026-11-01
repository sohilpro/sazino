/*
  Warnings:

  - A unique constraint covering the columns `[verified_hostname]` on the table `domains` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenant_id,hostname]` on the table `domains` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "domains_hostname_key";

-- AlterTable
ALTER TABLE "domains" ADD COLUMN     "check_failures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_checked_at" TIMESTAMPTZ(3),
ADD COLUMN     "verified_hostname" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "domains_verified_hostname_key" ON "domains"("verified_hostname");

-- CreateIndex
CREATE INDEX "domains_hostname_idx" ON "domains"("hostname");

-- CreateIndex
CREATE UNIQUE INDEX "domains_tenant_id_hostname_key" ON "domains"("tenant_id", "hostname");
