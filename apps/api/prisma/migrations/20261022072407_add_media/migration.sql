-- CreateTable
CREATE TABLE "media" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "alt" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_tenant_id_created_at_idx" ON "media"("tenant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "media_tenant_id_id_key" ON "media"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "product_images_media_id_idx" ON "product_images"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_images_product_id_media_id_key" ON "product_images"("product_id", "media_id");

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_tenant_id_product_id_fkey" FOREIGN KEY ("tenant_id", "product_id") REFERENCES "products"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_tenant_id_media_id_fkey" FOREIGN KEY ("tenant_id", "media_id") REFERENCES "media"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
