ALTER TABLE "etapas_cambio" ADD COLUMN "fecha_iniciada" DATE;

ALTER TABLE "solicitudes_cambio"
  ADD CONSTRAINT "solicitudes_cambio_probabilidad_riesgo_check" CHECK ("probabilidad_riesgo" BETWEEN 1 AND 5);

ALTER TABLE "solicitudes_cambio"
  ADD CONSTRAINT "solicitudes_cambio_impacto_riesgo_check" CHECK ("impacto_riesgo" BETWEEN 1 AND 5);

ALTER TABLE "etapas_cambio"
  ADD CONSTRAINT "etapas_cambio_porcentaje_adopcion_check" CHECK ("porcentaje_adopcion" IS NULL OR ("porcentaje_adopcion" >= 0 AND "porcentaje_adopcion" <= 100));
