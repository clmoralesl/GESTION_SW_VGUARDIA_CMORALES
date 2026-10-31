# Administrador de KPI y valor ganado

Documentación de arquitectura, catálogo de variables, fórmulas y valor ganado (EVM, Earned Value Management) para AutoFix Gestión.

---

## 1. Fecha de corte y configuración de entorno

Por defecto, el sistema utiliza la fecha actual provista por el reloj en la zona horaria `America/Santiago`. Para efectos de demostración, pruebas y auditoría histórica, el servicio de API soporta la variable de entorno `FECHA_CORTE` (formato ISO `AAAA-MM-DD`).

- **Variable de entorno:** `FECHA_CORTE=2026-11-16` en `.env` o `docker-compose.yml`.
- **Propósito:** fija la fecha de corte del `Reloj` central para evaluar el avance planificado, valor ganado (PV, EV, AC), tareas atrasadas e hitos respecto a un punto en el tiempo donde el proyecto se encuentra en ejecución, evitando que los indicadores salgan vacíos ("N/D") antes del inicio del proyecto. Si no se define o está vacía, el reloj utiliza la fecha actual del sistema.

---

## 2. Cálculo de valor ganado (EVM)

El módulo `packages/core/src/valorGanado.ts` implementa el estándar de gestión de valor ganado comparando tres magnitudes monetarias a la fecha de corte:

1. **PV (Planned Value - Valor planificado):**
   - Corresponde a la suma del costo planificado ponderado por la fracción de tiempo transcurrido de cada tarea hoja a la fecha de corte:
     $$\text{PV} = \sum_{\text{hojas}} \text{costoBase} \times \text{fraccionPlanificada}(\text{inicio}, \text{fin}, \text{corte})$$
   - La fracción planificada se distribuye linealmente por días hábiles según el calendario laboral del proyecto. Si `corte < inicio`, la fracción es 0; si `corte >= fin`, es 1; si la tarea no tiene días hábiles laborables, cuenta completa (1) al iniciar.
   - Si existe una línea base vigente, el PV se calcula sobre las tareas hoja de dicha línea base (deducidas por prefijo jerárquico de código, evitando duplicación con tareas padre). Si no existe línea base, se calcula sobre el plan actual.

2. **EV (Earned Value - Valor ganado):**
   - Corresponde al valor presupuestado del trabajo realmente ejecutado:
     $$\text{EV} = \sum_{\text{hojas actuales}} \text{costoBase}(\text{tarea}) \times \frac{\text{porcentajeAvance}}{100}$$
   - Se utiliza el costo base de la línea base vigente para cada tarea hoja. Si la tarea fue agregada después de la línea base, su costo base es 0 (no genera EV respecto a la línea base original).

3. **AC (Actual Cost - Costo real):**
   - Suma total de los costos reales devengados en las tareas hoja actuales (`costoReal` calculado a partir de las horas reales de profesionales y cantidades reales de recursos). Limitación documentada: no existiendo imputación granular por fecha de factura o parte diario, el AC suma el acumulado consolidado a la fecha de consulta.

4. **BAC (Budget at Completion - Presupuesto total planificado):**
   - Suma del costo planificado de las tareas hoja de la línea base vigente (o del plan actual si no existe línea base).

5. **Índices derivados:**
   - **SPI (Schedule Performance Index):** $\text{SPI} = \frac{\text{EV}}{\text{PV}}$. Un valor menor a 1 indica atraso en cronograma; 1 indica ejecución según el plan; mayor a 1 indica adelanto. Si $\text{PV} = 0$, resulta en división por cero devolviendo `null` ("N/D").
   - **CPI (Cost Performance Index):** $\text{CPI} = \frac{\text{EV}}{\text{AC}}$. Un valor menor a 1 indica sobrecosto; 1 indica costo según lo previsto; mayor a 1 indica eficiencia presupuestaria. Si $\text{AC} = 0$, devuelve `null` ("N/D").

---

## 3. Catálogo de variables del sistema

El motor expone 15 variables de ámbito `PROYECTO` disponibles para fórmulas:

| Código                 | Nombre               | Descripción                                                                         | Unidad     |
| ---------------------- | -------------------- | ----------------------------------------------------------------------------------- | ---------- |
| `PV`                   | Valor planificado    | Valor planificado acumulado a la fecha de corte                                     | CLP        |
| `EV`                   | Valor ganado         | Valor presupuestado del avance real a la fecha de corte                             | CLP        |
| `AC`                   | Costo real           | Costo real acumulado en las tareas a la fecha de corte                              | CLP        |
| `BAC`                  | Presupuesto total    | Presupuesto total planificado al término del proyecto                               | CLP        |
| `AVANCE_REAL`          | Avance real          | Porcentaje de avance ponderado consolidado del proyecto (0 a 100)                   | PORCENTAJE |
| `AVANCE_PLAN`          | Avance planificado   | Porcentaje de avance planificado ponderado por duración de la base                  | PORCENTAJE |
| `TAREAS_TOTAL`         | Total de tareas      | Cantidad de tareas hoja del proyecto                                                | NUMERO     |
| `TAREAS_ATRASADAS`     | Tareas atrasadas     | Tareas hoja con fin planificado anterior al corte y avance menor al 100 %           | NUMERO     |
| `DUR_PLAN_BASE`        | Duración de la base  | Días hábiles inclusive entre el inicio y el fin de la línea base                    | DIAS       |
| `DUR_ACTUAL`           | Duración actual      | Días hábiles inclusive entre el inicio y el fin del plan actual                     | DIAS       |
| `HITOS_TOTAL`          | Total de hitos       | Cantidad total de hitos del proyecto                                                | NUMERO     |
| `HITOS_CUMPLIDOS`      | Hitos cumplidos      | Hitos con fecha real de cumplimiento                                                | NUMERO     |
| `HITOS_A_TIEMPO`       | Hitos a tiempo       | Hitos cumplidos en o antes de su fecha objetivo                                     | NUMERO     |
| `HORAS_ASIGNADAS`      | Horas asignadas      | Total de horas planificadas asignadas a profesionales en el proyecto                | NUMERO     |
| `HORAS_SOBREASIGNADAS` | Horas sobreasignadas | Horas de este proyecto en días donde el profesional supera el 100 % de carga global | NUMERO     |

---

## 4. Motor de fórmulas y evaluación segura

- **Analizador:** se apoya en `mathjs.parse` en modo restringido y transforma el AST en una estructura propia (`NodoFormula`).
- **Lista blanca de operadores:** `+`, `-`, `*`, `/`, signos unarios `+` y `-`, operadores de comparación `>`, `<`, `>=`, `<=`, `==`, `!=`, y operador condicional ternario `? :`.
- **Funciones permitidas:** `min(...)`, `max(...)`, `abs(x)`, `round(x, decimales)`.
- **Protección contra inyección (OWASP A03):** no se expone `evaluate`, `compile`, importación de librerías, manipulación de prototipos, unidades ni variables no registradas en el catálogo.
- **División por cero y desbordes:** cualquier intento de división por cero o valor infinito se evalúa de forma perezosa y segura devolviendo `null`, que en la interfaz visual se renderiza como "N/D".

---

## 5. Umbrales y semáforos

Cada definición de KPI permite configurar cotas para los colores verde y amarillo:

- **Dirección `MAYOR_MEJOR`:** el valor es VERDE si $v \ge \text{verde}$; AMARILLO si $v \ge \text{amarillo}$; de lo contrario ROJO. Requiere $\text{amarillo} \le \text{verde}$.
- **Dirección `MENOR_MEJOR`:** el valor es VERDE si $v \le \text{verde}$; AMARILLO si $v \le \text{amarillo}$; de lo contrario ROJO. Requiere $\text{amarillo} \ge \text{verde}$.
- Si el valor es `null` o no hay umbral verde definido, el semáforo es nulo ("N/D" o "Sin umbral").
- **Comportamiento ante actualización de umbrales:** Modificar los umbrales o la dirección de un KPI existente no dispara automáticamente un recálculo retrospectivo de las mediciones históricas. Las mediciones ya guardadas preservan el semáforo calculado en su respectivo ciclo; los nuevos umbrales entran en vigor a partir del siguiente recálculo del proyecto.

---

## 6. Los 8 KPI iniciales sembrados

| Código                     | Fórmula                                              | Unidad     | Meta     | Dirección   | Umbral Verde | Umbral Amarillo |
| -------------------------- | ---------------------------------------------------- | ---------- | -------- | ----------- | ------------ | --------------- |
| `SPI`                      | `EV / PV`                                            | INDICE     | 1.0000   | MAYOR_MEJOR | 0.9500       | 0.8500          |
| `CPI`                      | `EV / AC`                                            | INDICE     | 1.0000   | MAYOR_MEJOR | 0.9500       | 0.8500          |
| `AVANCE_REAL_PCT`          | `AVANCE_REAL`                                        | PORCENTAJE | 100.0000 | MAYOR_MEJOR | (sin umbral) | (sin umbral)    |
| `CV_PCT`                   | `(EV - AC) / EV * 100`                               | PORCENTAJE | 0.0000   | MAYOR_MEJOR | 0.0000       | -10.0000        |
| `HITOS_A_TIEMPO_PCT`       | `HITOS_A_TIEMPO / HITOS_CUMPLIDOS * 100`             | PORCENTAJE | 100.0000 | MAYOR_MEJOR | 90.0000      | 70.0000         |
| `TAREAS_ATRASADAS_PCT`     | `TAREAS_ATRASADAS / TAREAS_TOTAL * 100`              | PORCENTAJE | 0.0000   | MENOR_MEJOR | 5.0000       | 15.0000         |
| `DESV_DURACION_PCT`        | `(DUR_ACTUAL - DUR_PLAN_BASE) / DUR_PLAN_BASE * 100` | PORCENTAJE | 0.0000   | MENOR_MEJOR | 5.0000       | 15.0000         |
| `HORAS_SOBREASIGNADAS_PCT` | `HORAS_SOBREASIGNADAS / HORAS_ASIGNADAS * 100`       | PORCENTAJE | 0.0000   | MENOR_MEJOR | 0.0000       | 10.0000         |
