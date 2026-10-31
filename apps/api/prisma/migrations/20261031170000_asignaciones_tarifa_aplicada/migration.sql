ALTER TABLE "asignaciones" ADD COLUMN "tarifa_aplicada" DECIMAL(12,2);
ALTER TABLE "asignaciones" ADD COLUMN "costo_unitario_aplicado" DECIMAL(12,2);

ALTER TABLE "asignaciones"
  ADD CONSTRAINT "asignaciones_tarifas_aplicadas_check" CHECK (
    ("profesional_id" IS NOT NULL AND "tarifa_aplicada" IS NOT NULL AND "tarifa_aplicada" >= 0 AND "costo_unitario_aplicado" IS NULL)
    OR
    ("recurso_id" IS NOT NULL AND "costo_unitario_aplicado" IS NOT NULL AND "costo_unitario_aplicado" >= 0 AND "tarifa_aplicada" IS NULL)
  );
