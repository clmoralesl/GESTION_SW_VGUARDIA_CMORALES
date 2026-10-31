# Sprint 01 · Levantamiento completo de AutoFix Gestión

**Objetivo del sprint:** entregar la aplicación integrada que cumple la rúbrica, sin EDT como módulo aparte y sin login. Debe correr en local con `docker compose up`, con el caso de prueba mínimo cargado y la demo de recálculo funcionando.

## Reglas para que los issues no se bloqueen

1. **Orden estricto:** los issues se resuelven en orden, y cada uno solo depende de los anteriores, nunca de uno posterior.
2. **Cada issue termina en algo ejecutable y visible**, ya sea un endpoint con su pantalla o tests en verde.
3. **El seed crece con cada issue:** cada uno agrega sus datos de ejemplo.
4. **El recálculo crece por pasos:** #9 crea el `RecalculoService` con el paso "fechas", y #13, #14 y #17 le agregan pasos sin modificar los anteriores.

### Definición de terminado (aplica a TODOS los issues)

- [ ] `pnpm build`, `pnpm lint` y `pnpm test` pasan sin errores desde la raíz.
- [ ] La funcionalidad se probó corriendo en Docker (`docker compose up`), no solo en local.
- [ ] El seed incluye datos para probar el issue y `pnpm db:reset` sigue funcionando.
- [ ] Las acciones de escritura respetan los permisos por rol, tanto en la UI como en la API.
- [ ] Los textos visibles están en español y no hay errores en la consola del navegador.
- [ ] El README se actualizó si cambió algo de instalación o uso.
- [ ] Las rutas de la API, sus parámetros, las cabeceras propias y las claves JSON están en español.
- [ ] El código no tiene comentarios (ni `//`, ni `/* */`, ni JSDoc); lo que necesite explicación va en `docs/`.

### Roles (sin login, selector en la barra superior)

| Acción                                                                           | Jefe de Proyecto (JP) | Comité de Cambios (CC) |
| -------------------------------------------------------------------------------- | --------------------- | ---------------------- |
| Proyecto, tareas, dependencias, hitos, recursos, asignaciones, KPI e importación | Editar                | Solo lectura           |
| Crear y editar solicitudes de cambio, registrar impacto y adjuntar evidencias    | Sí                    | Sí (evidencias)        |
| Avanzar etapas, aprobar o rechazar solicitudes                                   | No                    | Sí                     |
| Tableros, Gantt y bitácora                                                       | Ver                   | Ver                    |

Tamaños: **S** ≈ medio día · **M** ≈ 1 día · **L** ≈ 2 días.

---

## Fase 0 · Fundaciones

### #1 Monorepo y herramientas base · `S` · `infra`

**Alcance:** pnpm workspaces con `apps/web`, `apps/api` y `packages/core`; TypeScript estricto, ESLint, Prettier y Vitest.

**Criterios de aceptación**

- [ ] Existe `pnpm-workspace.yaml` con `apps/*` y `packages/*`.
- [ ] Existe `tsconfig.base.json` con `strict: true` y cada paquete lo extiende.
- [ ] `apps/web` y `apps/api` pueden importar `@autofix/core` sin errores de tipos.
- [ ] `pnpm build` compila los 3 paquetes en el orden correcto (core primero).
- [ ] `pnpm lint` ejecuta ESLint + Prettier en todo el repo y termina con 0 errores.
- [ ] `pnpm test` ejecuta Vitest en `packages/core` con al menos 1 test de ejemplo en verde.
- [ ] Existen `.editorconfig`, `.gitignore` (node_modules, dist, .env, uploads) y `.nvmrc` con Node 20 LTS o superior.

### #2 Docker Compose con los 4 servicios · `S` · `infra`

**Alcance:** servicios `db`, `api`, `web` y `adminer`, con recarga en caliente y `.env.example`.

**Criterios de aceptación**

- [ ] `docker compose up --build` en un clon limpio levanta los 4 servicios sin pasos manuales (aparte de copiar `.env.example` a `.env`).
- [ ] `db` usa PostgreSQL 16 con un volumen con nombre; los datos sobreviven a `docker compose down` + `up`.
- [ ] `api` expone `GET http://localhost:3000/salud`, que responde `200 {"estado":"ok","bd":"operativa"}`, y `"bd":"caida"` con `503` si la BD no responde.
- [ ] `web` responde en `http://localhost:5173` y muestra una página que consulta `/salud` y despliega el estado.
- [ ] `adminer` responde en `http://localhost:8088` y conecta a la BD con las credenciales de `.env`.
- [ ] Al editar un archivo `.ts` o `.tsx`, la API o la web se recargan sin reiniciar contenedores.
- [ ] `api` espera a que `db` esté sana (`depends_on` + `healthcheck`) antes de arrancar.

### #3 Modelo de datos completo y migración inicial · `M` · `backend` `datos`

**Alcance:** schema Prisma con todas las entidades del sistema, reglas de integridad y scripts de BD.

**Criterios de aceptación**

- [ ] El schema contiene: `Proyecto`, `Tarea`, `Dependencia`, `Calendario`, `Feriado`, `Profesional`, `TipoRecurso`, `Recurso`, `Asignacion`, `RegistroAvance`, `Hito`, `LineaBase`, `LineaBaseTarea`, `KpiDefinicion`, `KpiUmbral`, `KpiMedicion`, `Alerta`, `SolicitudCambio`, `EtapaCambio`, `Evidencia`, `ImpactoCambio` y `Bitacora`.
- [ ] `Tarea` tiene `nivel` (ETAPA / ACTIVIDAD / SUBACTIVIDAD), `parentId` y `codigo`; existe `unique(proyectoId, codigo)`.
- [ ] `Dependencia` tiene `tipo` (FS / SS / FF / SF) y `desfaseDias` (entero, puede ser negativo); existe `unique(predecesoraId, sucesoraId)` y no se permite una tarea dependiente de sí misma.
- [ ] Hay restricciones `CHECK` para `porcentajeAvance` entre 0 y 100, `fechaFin >= fechaInicio`, y duración, tarifa, cantidad y presupuesto mayores o iguales a 0.
- [ ] Las claves foráneas tienen `onDelete` definido explícitamente: cascada de tarea a asignaciones y dependencias, y restricción para borrar un profesional con asignaciones.
- [ ] `pnpm db:migrate` aplica la migración inicial en el contenedor `db` sin errores.
- [ ] `pnpm db:reset` borra la BD, migra y ejecuta el seed (vacío por ahora).
- [ ] Se generan `docs/modelo-datos.md` y el diagrama ER (prisma-erd o mermaid) desde el schema.

### #4 Estructura visual, tema y selector de rol · `M` · `frontend` `backend`

**Alcance:** estructura de pantalla de Mantine, tema corporativo, navegación, selector de proyecto y de rol, permisos por rol en la API, manejo de errores y cliente API.

**Criterios de aceptación**

- [ ] Hay un menú lateral con las entradas: Proyectos, Tareas, Gantt, Recursos, Hitos, KPI, Cambios, Tablero proyecto, Tablero cambio, Importar/Exportar y Bitácora (las pantallas aún no implementadas muestran "Próximamente").
- [ ] Tema corporativo: una paleta primaria sobria (azul petróleo o gris), tipografía Inter y modo claro/oscuro con un interruptor que se recuerda.
- [ ] Las fechas se muestran como `dd-mm-aaaa` y los montos en CLP con separador de miles (`$1.250.000`).
- [ ] El selector de rol (JP/CC) en la barra superior se guarda en `localStorage` y se envía en la cabecera `X-Rol` en cada llamada.
- [ ] El selector de proyecto activo se guarda en `localStorage` y sobrevive a la recarga de página.
- [ ] La API tiene un decorador `@Roles('JP')` + guard: una llamada con un rol no permitido responde `403` con un mensaje en español.
- [ ] Si falta `X-Rol` o el valor no es válido, la API responde `400`.
- [ ] Todos los errores de la API siguen un formato común en español: `{ codigo, error, mensaje, detalles? }`.
- [ ] Las rutas siguen la convención en español, en plural y con kebab-case: `/proyectos`, `/proyectos/:proyectoId/tareas`, `/solicitudes-cambio/:id/aprobar`.
- [ ] La UI muestra los errores de la API en un aviso emergente (toast) con el mensaje.
- [ ] Con rol CC, los botones de edición de las pantallas de planificación aparecen deshabilitados, con un tooltip "Solo Jefe de Proyecto".

---

## Fase 1 · Planificación

### #5 Administración de proyectos · `M` · `fullstack`

**Alcance:** crear, editar, ver y cerrar proyectos.

**Criterios de aceptación**

- [ ] La lista de proyectos muestra nombre, responsable, estado, presupuesto, % de avance y fechas, con búsqueda por nombre y filtro por estado.
- [ ] El formulario de creación valida: nombre obligatorio (máximo 120 caracteres), responsable obligatorio, presupuesto mayor o igual a 0 y `fechaFin >= fechaInicio`.
- [ ] El detalle del proyecto muestra sus datos y los totales (por ahora: número de tareas y avance).
- [ ] Al editar se guardan los cambios y queda un registro en `Bitacora` (entidad, campo, valor anterior y nuevo, rol, fecha).
- [ ] Los estados son Planificado, En curso y Cerrado, con las transiciones permitidas Planificado → En curso → Cerrado.
- [ ] La acción "Cerrar proyecto" pide confirmación; un proyecto cerrado rechaza cualquier modificación propia o de sus hijos con `409` y la UI lo muestra en solo lectura con un banner.
- [ ] Con rol CC no se puede crear, editar ni cerrar (403 en la API, botones deshabilitados).
- [ ] El seed incluye 1 proyecto "AutoFix · Implementación" en estado En curso.

### #6 Tareas jerárquicas y consolidación · `L` · `fullstack` `core`

**Alcance:** árbol etapa > actividad > subactividad, códigos automáticos y consolidación hacia arriba.

**Criterios de aceptación**

- [ ] Una tabla en árbol permite expandir y colapsar niveles y muestra: código, nombre, nivel, inicio/fin plan, inicio/fin real, duración, % de avance y responsable.
- [ ] Las reglas de jerarquía se validan en la API: una ETAPA no tiene padre, el padre de una ACTIVIDAD es una ETAPA y el de una SUBACTIVIDAD es una ACTIVIDAD. Si no se cumplen, la API responde `422`.
- [ ] Los códigos se generan solos: `1`, `1.2`, `1.2.3`. Al eliminar o mover una tarea, sus hermanas posteriores y sus descendientes se renumeran sin duplicados.
- [ ] Una tarea con hijas tiene fechas, duración y avance **calculados** (no editables en la UI): inicio = mínimo de sus hijas, fin = máximo de sus hijas.
- [ ] El % de avance de una tarea padre es el promedio de sus hijas ponderado por duración (`core/consolidacion.ts`).
- [ ] Eliminar una tarea con hijas pide confirmación e indica cuántas tareas se eliminarán en total.
- [ ] Tests en `core`: consolidación en 3 niveles, ponderación por duración, árbol con una sola hija, padre sin hijas, y renumeración tras borrar y tras mover.
- [ ] Editar el % de avance de una subactividad actualiza en pantalla su actividad, su etapa y el proyecto sin recargar la página.
- [ ] El seed incluye al menos 2 etapas con actividades y subactividades.

### #7 Calendario laboral · `S` · `core` `fullstack`

**Alcance:** días hábiles y feriados por proyecto.

**Criterios de aceptación**

- [ ] `core` exporta `esHabil(fecha, cal)`, `sumarDiasHabiles(fecha, n, cal)` (con `n` que puede ser negativo) y `diasHabilesEntre(a, b, cal)`.
- [ ] Por defecto se trabaja de lunes a viernes; los días laborables se pueden configurar por proyecto (checkbox por día de la semana).
- [ ] Hay una pantalla de feriados para listar, agregar y eliminar, con los feriados de Chile del año en curso precargados en el seed.
- [ ] Tests: sumar días cruzando un fin de semana, sumar días cruzando un feriado, sumar 0 días partiendo de un día no hábil, sumar días negativos, y `diasHabilesEntre` con las fechas invertidas.
- [ ] La duración de una tarea se expresa en **días hábiles** en toda la aplicación (se indica en la UI).

### #8 Motor de cronograma (CPM) · `L` · `core`

**Alcance:** función pura `calcularCronograma(tareas, dependencias, calendario)`.

**Criterios de aceptación**

- [ ] La función devuelve, por cada tarea: `inicioTemprano`, `finTemprano`, `inicioTardio`, `finTardio`, `holgura` y `esCritica`.
- [ ] **FS:** la sucesora empieza el día hábil siguiente al fin de la predecesora + desfase.
- [ ] **SS:** la sucesora empieza en el inicio de la predecesora + desfase.
- [ ] **FF:** la sucesora termina en el fin de la predecesora + desfase (su inicio se calcula hacia atrás según su duración).
- [ ] **SF:** la sucesora termina en el inicio de la predecesora + desfase.
- [ ] Un desfase negativo (adelanto) funciona en los 4 tipos.
- [ ] Si una tarea tiene varias predecesoras, se toma la restricción más tardía.
- [ ] Un ciclo lanza `CicloDetectadoError` con la lista ordenada de tareas que lo forman (por ejemplo `[1.1, 1.2, 2.1, 1.1]`).
- [ ] Una tarea con fecha de inicio real registrada respeta esa fecha y no se mueve.
- [ ] Las tareas sin predecesoras empiezan en la fecha de inicio del proyecto (o en su fecha fija, si tiene).
- [ ] Las dependencias solo se admiten entre tareas hoja (subactividades, o actividades sin hijas); las tareas padre se consolidan con #6.
- [ ] Hay al menos 15 tests: cada tipo de dependencia con y sin desfase (8), varias predecesoras, una cadena de 5 tareas en cascada, un ciclo directo (A→B→A), un ciclo indirecto (A→B→C→A), una fecha real fija, un fin de semana dentro de la cadena y la ruta crítica de un ejemplo calculado a mano.
- [ ] Procesar 500 tareas y 800 dependencias toma menos de 200 ms (test de rendimiento).

### #9 Dependencias y recálculo automático · `M` · `fullstack`

**Alcance:** CRUD de dependencias en la UI, `RecalculoService` con el paso "fechas" y manejo de ciclos.

**Criterios de aceptación**

- [ ] En el detalle de una tarea se pueden ver, agregar y eliminar predecesoras: selector de tarea, tipo FS/SS/FF/SF y desfase en días.
- [ ] `RecalculoService.ejecutar(proyectoId, tx)` corre dentro de la misma transacción que la modificación que lo origina; si falla, se revierte todo.
- [ ] Modificar la duración, las fechas o las dependencias de una tarea dispara el recálculo y persiste las nuevas fechas de **todas** las sucesoras directas e indirectas.
- [ ] La respuesta de la API incluye `tareasAfectadas: [{codigo, inicioAnterior, inicioNuevo, finAnterior, finNuevo}]` y la UI lo muestra como resumen en un aviso emergente ("5 tareas reprogramadas").
- [ ] Crear una dependencia que cierra un ciclo responde `422` con la cadena del ciclo; la UI muestra "Ciclo detectado: 1.1 → 1.2 → 2.1 → 1.1" y no se guarda nada.
- [ ] Una dependencia duplicada (mismo par de tareas) se rechaza con `409`.
- [ ] Cada recálculo queda registrado en `Bitacora` con su origen (por ejemplo "cambio de duración en 2.1.3").
- [ ] Test de integración de la API: cambiar la duración de A en la cadena A→B→C (FS) mueve B y C la cantidad correcta de días hábiles.

### #10 Hitos · `S` · `fullstack`

**Alcance:** CRUD de hitos con estado calculado.

**Criterios de aceptación**

- [ ] Un hito tiene: nombre, fecha objetivo, tarea vinculada (opcional), criterio de cumplimiento, fecha real de cumplimiento y responsable.
- [ ] El estado se calcula y no se edita:
  - **Cumplido:** tiene fecha real.
  - **Atrasado:** hoy es posterior a la fecha objetivo y no tiene fecha real, **o** el fin calculado de su tarea vinculada es posterior a la fecha objetivo.
  - **En riesgo:** faltan 5 días hábiles o menos y la tarea vinculada lleva menos de 80% de avance.
  - **Pendiente:** cualquier otro caso.
- [ ] Al mover la tarea vinculada (recálculo), el estado del hito se actualiza en la misma respuesta.
- [ ] La lista de hitos muestra el estado con un color (verde, amarillo, rojo, gris) y permite filtrar por estado.
- [ ] El seed incluye al menos 3 hitos vinculados.

### #11 Carta Gantt · `L` · `frontend`

**Alcance:** Gantt jerárquico, dinámico e interactivo.

**Criterios de aceptación**

- [ ] Tiene una grilla izquierda con código, nombre, duración, inicio y fin, alineada con las barras; las tareas padre se pueden colapsar.
- [ ] Las tareas padre se dibujan con barras de resumen (estilo distinto) y las hojas con barras normales; el % de avance se ve como relleno dentro de cada barra.
- [ ] Muestra flechas para los 4 tipos de dependencia, cada una saliendo del borde correcto (inicio o fin) según el tipo.
- [ ] Los hitos se dibujan como rombos en su fecha objetivo, con el color de su estado.
- [ ] Una línea vertical marca "hoy".
- [ ] Las tareas atrasadas (fin plan anterior a hoy y avance menor a 100%) se marcan en rojo.
- [ ] Un interruptor "Ruta crítica" resalta las tareas con `esCritica = true`.
- [ ] Un interruptor "Línea base" muestra una barra delgada gris bajo cada tarea con las fechas de la línea base vigente (si no hay línea base, aparece deshabilitado con un tooltip).
- [ ] Al arrastrar una barra (mover) o estirarla (cambiar duración), se llama a la API, se recalcula y se redibujan las sucesoras **sin recargar la página**.
- [ ] Si mover una barra generaría una situación inválida, se revierte la posición y se muestra el error.
- [ ] Tiene zoom Día / Semana / Mes y un botón "Ir a hoy".
- [ ] Exporta a PNG y PDF lo que se ve en pantalla.
- [ ] Con rol CC el Gantt es de solo lectura (no se puede arrastrar).
- [ ] Carga 60 tareas en menos de 1 segundo.

---

## Fase 2 · Recursos y costos

### #12 Profesionales y recursos · `M` · `fullstack`

**Alcance:** catálogo de profesionales, tipos de recurso y recursos.

**Criterios de aceptación**

- [ ] Un profesional tiene: nombre, rol o cargo, tarifa por hora (CLP), horas disponibles por día (por defecto 8) y estado activo/inactivo.
- [ ] Los tipos de recurso fijos en el seed son Humano, Equipamiento, Material y Servicio.
- [ ] Un recurso tiene: nombre, tipo, unidad (hora, unidad, mes, licencia…) y costo unitario (CLP).
- [ ] Las tablas tienen búsqueda, orden por columna y edición en un modal con validación (tarifa y costo mayores o iguales a 0, nombre obligatorio).
- [ ] No se puede eliminar un profesional o recurso que tenga asignaciones (`409` con el mensaje "tiene N asignaciones"); en ese caso solo se puede desactivar.
- [ ] El seed incluye 5 profesionales y al menos 1 recurso de cada uno de los 4 tipos.

### #13 Asignaciones, costos y sobreasignación · `L` · `fullstack` `core`

**Alcance:** asignar profesionales y recursos a tareas, calcular costos y detectar sobreasignación.

**Criterios de aceptación**

- [ ] Desde el detalle de una tarea hoja se asignan:
  - Profesionales, con % de dedicación (1 a 100), horas plan (calculadas: duración × horas/día × dedicación, pero editables) y horas reales.
  - Recursos, con cantidad plan y cantidad real.
- [ ] `core/costos.ts` calcula:
  - Costo plan de una tarea = Σ(horas plan × tarifa) + Σ(cantidad plan × costo unitario).
  - Costo real = lo mismo con horas y cantidades reales.
- [ ] Los costos plan y real se suman de la subactividad a la actividad, la etapa y el proyecto, sin contar nada dos veces (test con un árbol de 3 niveles).
- [ ] `RecalculoService` incorpora el paso **costos** después de **fechas**: al cambiar una duración se recalculan las horas plan (si no se editaron a mano) y los costos.
- [ ] El proyecto muestra presupuesto, costo plan, costo real y la diferencia en monto y %; si el costo plan supera el presupuesto, aparece una alerta.
- [ ] **Sobreasignación:** si en un día hábil la suma de horas asignadas a un profesional (dedicación × horas/día en todas sus tareas activas ese día) supera sus horas disponibles, se crea una `Alerta` tipo SOBREASIGNACION con el profesional, el rango de fechas y las tareas en conflicto.
- [ ] Las alertas de sobreasignación desaparecen solas cuando el conflicto se resuelve.
- [ ] La vista "Carga de recursos" muestra un mapa de calor de profesionales × semanas con el % de ocupación, y las celdas sobre 100% en rojo.
- [ ] Tests en `core`: costos con profesionales y recursos, consolidación, sobreasignación de 2 tareas en paralelo al 60% cada una (alerta), y 2 tareas secuenciales al 100% (sin alerta).

---

## Fase 3 · KPI

### #14 Administrador de KPI · `L` · `fullstack` `core`

**Alcance:** variables del sistema, KPI configurables, umbrales, historial y alertas.

**Criterios de aceptación**

- [ ] Un catálogo de variables muestra nombre, descripción, ámbito y valor actual. Incluye al menos:
  - Valor ganado: `PV`, `EV`, `AC`, `BAC`.
  - Avance y tareas: `AVANCE_REAL`, `AVANCE_PLAN`, `TAREAS_TOTAL`, `TAREAS_ATRASADAS`, `DUR_PLAN_BASE`, `DUR_ACTUAL`.
  - Hitos: `HITOS_TOTAL`, `HITOS_CUMPLIDOS`, `HITOS_A_TIEMPO`.
  - Recursos: `HORAS_SOBREASIGNADAS`, `HORAS_ASIGNADAS`.
- [ ] El cálculo de PV, EV y AC a la fecha de corte está documentado y tiene tests (`core/valorGanado.ts`).
- [ ] Una definición de KPI tiene: código, nombre, ámbito (PROYECTO / HITO / CAMBIO), fórmula, unidad (%, índice, días, CLP, número), meta, dirección (MAYOR_MEJOR / MENOR_MEJOR) y umbrales (verde desde X, amarillo desde Y, rojo bajo Y).
- [ ] El editor de fórmulas tiene autocompletado de variables, valida la sintaxis en vivo y muestra el resultado con los datos actuales antes de guardar.
- [ ] Una fórmula con una variable inexistente o una función no permitida se rechaza (`422`); mathjs se usa en modo restringido (sin `import`, `createUnit`, `evaluate` anidado ni acceso a objetos).
- [ ] Una división por cero devuelve `null` y la UI muestra "N/D" en lugar de un error.
- [ ] `RecalculoService` incorpora el paso **KPI**: en cada recálculo guarda una `KpiMedicion` (valor, semáforo, fecha) por KPI activo.
- [ ] Cuando un KPI pasa a amarillo o rojo se crea una `Alerta` tipo KPI; cuando vuelve a verde, la alerta se cierra sola.
- [ ] El detalle de un KPI muestra un gráfico de línea con su historial, la meta como línea de referencia y las bandas de umbral.
- [ ] El seed incluye los **8 KPI de proyecto e hitos**: SPI, CPI, % de avance real, variación de costo (CV%), % de hitos a tiempo, % de tareas atrasadas, desviación de duración y % de horas sobreasignadas.
- [ ] Prueba manual documentada: con `FECHA_CORTE` fija, al bajar el avance real de una tarea crítica en curso, el SPI baja, se agrega una medición al historial y, si cruza el umbral, aparece una alerta. Al alargar una tarea crítica, sube la desviación de duración con el mismo efecto. Alargar una tarea no cambia el SPI porque el PV se mide contra la línea base.

---

## Fase 4 · Gestión del cambio

### #15 Solicitudes de cambio y las 10 etapas · `L` · `fullstack`

**Alcance:** registro y seguimiento de solicitudes, las 10 etapas y evidencias.

**Criterios de aceptación**

- [ ] Una solicitud tiene: código automático (`SC-001`), título, descripción, justificación, solicitante, responsable, prioridad (Baja/Media/Alta/Crítica), categoría (Alcance/Plazo/Costo/Recurso/Calidad), probabilidad e impacto del riesgo (1 a 5), estado de decisión y etapa actual.
- [ ] Al crear una solicitud se generan sus 10 `EtapaCambio` con estos nombres, en orden:
  1. Identificar la necesidad del cambio
  2. Analizar y evaluar la realización del cambio
  3. Evaluación de los riesgos
  4. Planificación
  5. Comunicación del cambio
  6. Implementación del cambio
  7. Evaluación y seguimiento del plan de trabajo
  8. Comunicación de los resultados a corto plazo
  9. Generar las acciones correctivas
  10. Adoptar el cambio en la cultura de la empresa
- [ ] Cada etapa tiene: responsable, fecha de inicio, fecha de fin, estado (Pendiente / En curso / Completada / Omitida), comentario y evidencias.
- [ ] Una etapa solo se completa si la anterior está Completada u Omitida. Omitir una etapa exige un comentario.
- [ ] La etapa 10 tiene además el campo `% de adopción` (0 a 100).
- [ ] La etapa 9 permite registrar **acciones correctivas** (descripción, responsable, fecha compromiso, estado).
- [ ] Las evidencias se suben como PDF, imagen, Excel o Word (máximo 10 MB), se guardan en el volumen `uploads` y se pueden descargar desde la UI.
- [ ] Transiciones del estado de decisión: Registrada → En evaluación (al iniciar la etapa 2) → Aprobada / Rechazada (en #16) → Implementada (al completar la etapa 6) → Cerrada (al completar la etapa 10). Una transición inválida responde `409`.
- [ ] Hay filtros combinables por estado, etapa actual, responsable, prioridad, categoría, nivel de riesgo y rango de fechas.
- [ ] El detalle muestra una línea de tiempo horizontal de las 10 etapas con su estado y duración real.
- [ ] Permisos: JP crea y edita solicitudes y adjunta evidencias; solo CC avanza y completa etapas (403 en otro caso).
- [ ] El seed incluye 5 solicitudes en distintos estados (al menos 1 Registrada, 1 En evaluación, 1 Aprobada, 1 Rechazada y 1 Cerrada).

### #16 Impacto, aprobación y línea base · `L` · `fullstack`

**Alcance:** impacto propuesto, simulación, aprobación transaccional y comparación de líneas base.

**Criterios de aceptación**

- [ ] Una solicitud puede registrar impactos de estos tipos:
  - Cambiar la duración de una tarea.
  - Agregar, quitar o modificar una asignación.
  - Agregar una tarea nueva (con su padre y sus dependencias).
  - Ajustar el presupuesto.
- [ ] El botón "Simular" ejecuta el recálculo **sin guardar** (transacción que se revierte) y muestra el antes y después de la fecha de fin del proyecto, el costo plan, el SPI, el CPI y las tareas afectadas.
- [ ] El botón "Aprobar" solo está disponible para CC con la etapa 3 completada; si no, responde `409`.
- [ ] Al aprobar, en **una sola transacción**:
  1. Se crea una `LineaBase` (versión N+1) con una copia de las fechas, duraciones y costos de todas las tareas.
  2. Se aplican los impactos.
  3. Se ejecuta el `RecalculoService` completo (fechas → costos → KPI → alertas).
  4. La solicitud pasa a Aprobada.
  5. Se registra todo en `Bitacora` con referencia a la solicitud.
- [ ] Si algún paso falla (por ejemplo, un impacto genera un ciclo), no se guarda nada y la UI muestra el motivo.
- [ ] "Rechazar" exige un motivo y no modifica la planificación.
- [ ] El comparador de líneas base permite elegir dos versiones y muestra una tabla por tarea con fechas, duración y costo, las diferencias resaltadas y los totales.
- [ ] El Gantt (interruptor "Línea base" de #11) usa por defecto la línea base anterior a la última aprobación.
- [ ] La primera vez que un proyecto pasa a "En curso" se crea automáticamente la línea base v1.
- [ ] Test de integración: aprobar una solicitud que aumenta en 3 días una tarea crítica mueve la fecha de fin del proyecto 3 días hábiles, cambia el SPI y crea la línea base v2.

### #17 KPI de gestión del cambio · `M` · `backend` `datos`

**Alcance:** variables de cambio y los 12 KPI de cambio.

**Criterios de aceptación**

- [ ] Hay nuevas variables en el catálogo:
  - Volumen de solicitudes: `SC_TOTAL`, `SC_APROBADAS`, `SC_RECHAZADAS`, `SC_ABIERTAS`.
  - Tiempos: `SC_TIEMPO_CICLO_PROM` (días desde el registro hasta el cierre), `SC_TIEMPO_EVAL_PROM` (de la etapa 1 a la decisión), `SC_ETAPAS_VENCIDAS`.
  - Impacto: `SC_IMPACTO_COSTO_TOTAL`, `SC_IMPACTO_DIAS_TOTAL`.
  - Acciones correctivas: `SC_ACC_CORRECTIVAS_TOTAL`, `SC_ACC_CORRECTIVAS_CERRADAS`.
  - Adopción y riesgo: `SC_ADOPCION_PROM`, `SC_RIESGO_ALTO`.
- [ ] El seed incluye los **12 KPI de cambio**, marcando cuáles son los **3 adicionales**: tiempo de ciclo promedio, % de acciones correctivas cerradas e índice de adopción.
- [ ] Avanzar o completar una etapa, o aprobar o rechazar una solicitud, ejecuta el paso **KPI** y guarda nuevas mediciones.
- [ ] Hay una alerta automática de **etapa vencida** cuando una etapa En curso pasa su fecha de fin sin completarse.
- [ ] Los 12 KPI muestran un valor (no N/D) con los datos del seed.

---

## Fase 5 · Tableros

### #18 Tablero de comando del proyecto · `M` · `frontend`

**Criterios de aceptación**

- [ ] Hay 4 tarjetas de resumen: % de avance real contra plan, SPI, CPI y costo real contra presupuesto, con el color de su umbral y la variación respecto a la medición anterior.
- [ ] Muestra una curva S con PV, EV y AC acumulados en el tiempo.
- [ ] Muestra los hitos en una línea de tiempo con su estado y color, y el número de cumplidos sobre el total.
- [ ] Muestra el costo plan contra el real por etapa (barras agrupadas).
- [ ] Muestra la carga por profesional (barras horizontales con el % de ocupación, en rojo sobre 100%).
- [ ] Muestra una tabla de tareas atrasadas (código, nombre, días de atraso, responsable) que lleva al Gantt al hacer clic.
- [ ] Muestra un panel de alertas activas (KPI, sobreasignación, presupuesto, hitos) con fecha y origen.
- [ ] Tiene filtros por etapa, profesional y rango de fechas, que afectan a todos los gráficos a la vez.
- [ ] Cualquier modificación en otra pantalla (duración, asignación, aprobación) se refleja al volver al tablero **sin recargar la página** (invalidación de TanStack Query).

### #19 Tablero de comando del cambio · `M` · `frontend`

**Criterios de aceptación**

- [ ] Hay tarjetas de resumen: solicitudes totales, abiertas, aprobadas y rechazadas, y tasa de aprobación.
- [ ] Muestra un gráfico de embudo con cuántas solicitudes hay en cada una de las 10 etapas.
- [ ] Muestra una matriz de riesgo de 5×5 (probabilidad × impacto) con las solicitudes ubicadas y coloreadas por prioridad.
- [ ] Muestra el tiempo promedio por etapa (barras) y el tiempo de ciclo promedio.
- [ ] Muestra el % de adopción por solicitud cerrada y el promedio general.
- [ ] Muestra una grilla con los 12 KPI de cambio, cada uno con su semáforo y un mini-gráfico de su historial.
- [ ] Muestra un panel de alertas: etapas vencidas, riesgos altos y KPI en rojo.
- [ ] Tiene filtros por prioridad, categoría, nivel de riesgo, responsable y periodo.
- [ ] Al aprobar o avanzar una solicitud, el tablero se actualiza sin recargar la página.
- [ ] El tablero de proyecto y el de cambio son pantallas distintas, con indicadores que no se repiten.

---

## Fase 6 · Carga masiva por Excel

### #20 Plantilla de carga inicial (importar y exportar) · `L` · `fullstack`

**Criterios de aceptación**

- [ ] El botón "Descargar plantilla" entrega `plantilla_carga_autofix.xlsx` con estas hojas, en orden:
  - `Instrucciones`, `Proyecto`, `Calendario`, `Feriados`
  - `Tareas`, `Dependencias`, `Profesionales`, `Recursos`
  - `Asignaciones`, `Hitos`, `KPI`, `Solicitudes`
- [ ] Cada hoja tiene encabezados con estilo y fijos al hacer scroll; las columnas obligatorias se marcan con `*`, y cada columna tiene un comentario que explica su formato.
- [ ] Las columnas con valores fijos tienen lista desplegable: nivel, tipo de dependencia, tipo de recurso, prioridad, categoría y ámbito de KPI.
- [ ] Las tareas se referencian por **código** (`1.2.3`) y los profesionales y recursos por **nombre**, no por ID interno.
- [ ] Al subir el archivo se muestra una vista previa por hoja con el número de filas válidas e inválidas y una tabla de errores (hoja, fila, columna y mensaje en español, por ejemplo "Tareas!F12: la fecha de fin es anterior a la de inicio").
- [ ] Se valida **entre hojas**: referencias a códigos inexistentes, ciclos en las dependencias, padres con el nivel incorrecto y nombres duplicados.
- [ ] El botón "Confirmar importación" queda deshabilitado mientras haya errores.
- [ ] La importación se hace en **una sola transacción** (si una fila falla al insertar, no se guarda nada) y al terminar ejecuta el `RecalculoService` completo.
- [ ] Se puede importar a un proyecto nuevo o reemplazar un proyecto vacío; si el proyecto ya tiene datos, se pide confirmación explícita antes de reemplazar.
- [ ] El botón "Exportar proyecto" genera un archivo con el mismo formato y los datos actuales.
- [ ] Prueba de ida y vuelta (test automático): exportar un proyecto e importarlo en uno nuevo da el mismo número de tareas, dependencias, asignaciones, la misma fecha de fin y el mismo costo plan total.
- [ ] Solo el rol JP puede importar; ambos roles pueden exportar.

---

## Fase 7 · Cierre e integración

### #21 Caso de prueba mínimo completo · `M` · `datos`

**Criterios de aceptación**

- [ ] `pnpm db:reset` carga exactamente:

  | Elemento                  | Cantidad                                                            |
  | ------------------------- | ------------------------------------------------------------------- |
  | Etapas                    | 4                                                                   |
  | Actividades               | 12                                                                  |
  | Subactividades            | 20                                                                  |
  | Tipos de dependencia      | Los 4 (FS, SS, FF y SF, al menos 1 de cada uno, alguno con desfase) |
  | Profesionales             | 5                                                                   |
  | Tipos de recurso          | 4                                                                   |
  | Hitos                     | 6                                                                   |
  | KPI de proyecto e hitos   | 8                                                                   |
  | Solicitudes de cambio     | 5                                                                   |
  | KPI de gestión del cambio | 12                                                                  |

- [ ] Al menos 1 profesional queda sobreasignado y al menos 1 tarea atrasada, para que los tableros muestren alertas.
- [ ] Existe `docs/caso_prueba.xlsx` en el formato de #20 y, al importarlo, se obtienen los mismos datos que con el seed.
- [ ] Un test end-to-end (Playwright) de la demo ejecuta:
  1. Cambiar la duración de una subactividad crítica → verifica que se movieron las sucesoras en el Gantt, cambió el costo y cambió el SPI.
  2. Modificar una asignación de recurso → verifica que cambiaron el costo real y plan, el CPI y la alerta de sobreasignación.
  3. Con rol CC, aprobar una solicitud → verifica la línea base nueva, el Gantt con la línea base, el tablero de proyecto actualizado y el tablero de cambio actualizado.
- [ ] El test end-to-end corre con `pnpm test:e2e` contra los contenedores levantados.

### #22 Bitácora y trazabilidad visibles · `S` · `fullstack`

**Criterios de aceptación**

- [ ] La pantalla Bitácora muestra fecha y hora, rol, entidad, acción, campo, valor anterior, valor nuevo y origen (manual, recálculo, aprobación SC-00X o importación).
- [ ] Se puede filtrar por entidad, rol, tipo de acción y rango de fechas, y paginar del lado del servidor.
- [ ] El detalle de cada tarea y de cada solicitud tiene una pestaña "Historial" con sus propios registros.
- [ ] Desde un registro originado por una solicitud se puede navegar a esa solicitud.
- [ ] La bitácora es solo de lectura para ambos roles: no existe un endpoint para editarla ni borrarla.

### #23 Documentación técnica y guion de demo · `M` · `docs`

**Criterios de aceptación**

- [ ] `README.md`: requisitos previos, instalación con Docker en 3 comandos, URLs de los servicios y comandos de `pnpm`.
- [ ] `docs/arquitectura.md`: diagrama de módulos, flujo del `RecalculoService` y decisiones técnicas justificadas (monolito modular, motor propio de cronograma).
- [ ] `docs/modelo-datos.md`: diagrama ER, descripción de cada entidad y lista de reglas de integridad.
- [ ] `docs/motor-cronograma.md`: explicación de FS/SS/FF/SF con ejemplos numéricos, detección de ciclos y ruta crítica.
- [ ] `docs/kpi.md`: los 20 KPI con su fórmula, variables, meta, umbrales e interpretación.
- [ ] `docs/manual-usuario.md`: tareas por rol, con capturas de pantalla.
- [ ] `docs/guion-demo.md`: los pasos de la demostración con los valores esperados antes y después de cada acción.
- [ ] Requisitos y casos de prueba entregados como documentos aparte en `docs/entregables/`.

---

## Orden de ejecución

```
#1 → #2 → #3 → #4 → #5 → #6 → #7 → #8 → #9 → #10 → #11
   → #12 → #13 → #14 → #15 → #16 → #17 → #18 → #19 → #20 → #21 → #22 → #23
```

Hitos de control sugeridos:

- **Tras #11:** cronograma demostrable.
- **Tras #14:** proyecto con costos y KPI.
- **Tras #17:** flujo completo de cambio.
- **Tras #21:** demo lista.
