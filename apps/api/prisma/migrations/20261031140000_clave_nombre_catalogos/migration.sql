ALTER TABLE "profesionales" ADD COLUMN "clave_nombre" VARCHAR(120);

UPDATE "profesionales" SET "clave_nombre" = lower("nombre");

ALTER TABLE "profesionales" ALTER COLUMN "clave_nombre" SET NOT NULL;

CREATE UNIQUE INDEX "profesionales_clave_nombre_key" ON "profesionales"("clave_nombre");

ALTER TABLE "recursos" ADD COLUMN "clave_nombre" VARCHAR(120);

UPDATE "recursos" SET "clave_nombre" = lower("nombre");

ALTER TABLE "recursos" ALTER COLUMN "clave_nombre" SET NOT NULL;

CREATE UNIQUE INDEX "recursos_clave_nombre_key" ON "recursos"("clave_nombre");
