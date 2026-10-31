# Carta Gantt: Geometría, Interacción, Validación y Exportación

Este documento detalla la arquitectura técnica, modelos geométricos, algoritmos de trazado, reglas de arrastre y manipulación, validaciones de restricciones hacia adelante y mecanismos de exportación gráfica de la carta Gantt implementada en el issue #11.

---

## 1. Arquitectura y Renderizado en el Monorepo

La carta Gantt está estructurada separando rigurosamente la lógica pura de cronograma, las funciones puras geométricas de escala y trazado, y los componentes de vista interactivos:

1. **`packages/core`**:
   - `cronograma.ts`: Algoritmo CPM, cálculo de holguras, ruta crítica y la función pura `preverInicioTarea` con detección de la restricción limitante.
   - `atraso.ts`: Predicado puro `estaAtrasada` para determinar si una tarea hoja está retrasada respecto de la fecha de referencia `hoy`.
   - `lineas-base.ts`: Tipos estructurales para representar líneas base vigentes del proyecto y sus tareas congeladas.

2. **`apps/api`**:
   - `lineas-base`: Módulo de consulta de la línea base vigente (`GET /proyectos/:proyectoId/lineas-base/vigente`), con control de acceso por rol (`JP` y `CC`).

3. **`apps/web` (`src/gantt/`)**:
   - `escala.ts`: Transformaciones bidireccionales entre fechas ISO (`YYYY-MM-DD`) y coordenadas horizontales en píxeles (`x`), con soporte para niveles de zoom Día (32 px/día), Semana (16 px/día) y Mes (6 px/día).
   - `flechas.ts`: Generación ortogonal determinista de trayectorias SVG tipo `Manhattan` (3 o 5 segmentos) para dependencias FS, SS, FF y SF.
   - `arrastre.ts`: Reglas de redondeo de deltas de arrastre, cálculo de nuevas fechas de inicio y duraciones hábiles bajo el calendario laboral.
   - `modelo-gantt.ts`: Transformación del árbol de tareas, dependencias, hitos y calendario en un modelo geométrico listo para renderizado SVG.
   - `paleta-gantt.ts`: Resolución de colores semánticos dinámicos dependientes del tema claro/oscuro de Mantine.
   - `exportar.ts`: Exportación de la ventana visible del SVG hacia formatos PNG y PDF vectorial con incrustación de la tipografía Inter en base64 para operación 100 % autónoma sin conexión a internet.

---

## 2. Geometría de Barras y Puntos de Conexión

Cada fila del diagrama posee una altura constante de `ALTO_FILA = 32` píxeles. La coordenada vertical de referencia es el centro de la fila:

$$\text{yCentro} = \text{fila} \times \text{ALTO\_FILA} + \frac{\text{ALTO\_FILA}}{2}$$

### 2.1 Puntos de Salida y Llegada por Tipo de Dependencia

Las dependencias conectan una tarea predecesora ($P$) con una sucesora ($S$). El extremo de conexión depende estrictamente del par origen-destino:

| Tipo   | Semántica           | Salida en Predecesora ($P$)   | Llegada en Sucesora ($S$)     | Sentido Llegada         |
| :----- | :------------------ | :---------------------------- | :---------------------------- | :---------------------- |
| **FS** | Fin a Comienzo      | Extremo derecho (`xFin`)      | Extremo izquierdo (`xInicio`) | Hacia la derecha (+1)   |
| **SS** | Comienzo a Comienzo | Extremo izquierdo (`xInicio`) | Extremo izquierdo (`xInicio`) | Hacia la derecha (+1)   |
| **FF** | Fin a Fin           | Extremo derecho (`xFin`)      | Extremo derecho (`xFin`)      | Hacia la izquierda (-1) |
| **SF** | Comienzo a Fin      | Extremo izquierdo (`xInicio`) | Extremo derecho (`xFin`)      | Hacia la izquierda (-1) |

---

## 3. Trazado Ortogonal de Flechas: Regla de 3 y 5 Segmentos

El trazado de dependencias se genera mediante segmentos ortogonales deterministas (codos a 90 grados) utilizando la función `rutaFlecha`:

1. **Separación de seguridad mínima**: Toda conexión se separa un delta fijo $D = 12$ píxeles hacia afuera del borde de la barra antes de girar verticalmente:
   - Salida desde Fin: $x_1 = x_{\text{salida}} + D$
   - Salida desde Comienzo: $x_1 = x_{\text{salida}} - D$
   - Llegada hacia Comienzo: $x_2 = x_{\text{llegada}} - D$
   - Llegada hacia Fin: $x_2 = x_{\text{llegada}} + D$

2. **Regla de 3 Segmentos (Ruta directa en Z)**:
   Se utiliza cuando existe suficiente separación horizontal para avanzar en línea recta entre las tareas:
   - Para llegada hacia la derecha (+1): aplicable si $x_1 \le x_2$. La vertical intermedia se sitúa en $x_m = \frac{x_1 + x_2}{2}$.
   - Para llegada hacia la izquierda (-1): aplicable si $x_1 \ge x_2$. La vertical intermedia se sitúa en $x_m = \frac{x_1 + x_2}{2}$.
   - Secuencia de 4 puntos (3 segmentos):
     $$(x_{\text{salida}}, y_{\text{salida}}) \to (x_m, y_{\text{salida}}) \to (x_m, y_{\text{llegada}}) \to (x_{\text{llegada}}, y_{\text{llegada}})$$

3. **Regla de 5 Segmentos (Ruta en U o retroceso)**:
   Se utiliza cuando no hay espacio horizontal entre salida y llegada en el sentido del flujo (por ejemplo, en solapes negativos o retrocesos temporales).
   - Se traza un canal vertical intermedio horizontal entre las dos filas:
     $$y_m = \frac{y_{\text{salida}} + y_{\text{llegada}}}{2}$$
   - Secuencia de 6 puntos (5 segmentos):
     $$(x_{\text{salida}}, y_{\text{salida}}) \to (x_1, y_{\text{salida}}) \to (x_1, y_m) \to (x_2, y_m) \to (x_2, y_{\text{llegada}}) \to (x_{\text{llegada}}, y_{\text{llegada}})$$

---

## 4. Regla de Redondeo de Arrastre por Sentido

Al desplazar una barra horizontalmente en pantalla mediante el puntero o ratón:

1. El cambio en píxeles $\Delta x$ se convierte en días dividiendo por el paso de la escala:
   $$\text{razon} = \frac{\Delta x}{\text{pxPorDia}}$$

2. Para evitar asimetrías perceptuales donde los movimientos hacia la izquierda requieran mayor distancia que hacia la derecha, se aplica redondeo simétrico respecto al cero y normalización de signo:
   ```ts
   const razon = deltaPx / pxPorDia;
   const redondeado = razon < 0 ? -Math.round(-razon) : Math.round(razon);
   return Object.is(redondeado, -0) ? 0 : redondeado;
   ```
   De esta manera, en zoom Día (32 px/día), desplazamientos de $\pm 16$ px redondean equitativamente a $\pm 1$ día, y $-0$ se normaliza a $0$.

---

## 5. Previsión de Inicio Mínimo y Validación Local

Para prevenir inconsistencias antes de despachar mutaciones de red al servidor, la función `preverInicioTarea` en `packages/core` evalúa el inicio planificado más temprano viable:

1. **Evaluación de dependencias entrantes**:
   Dada una tarea, se evalúan todas sus relaciones de precedencia aplicando la restricción hacia adelante correspondiente (`FS`, `SS`, `FF`, `SF`) combinada con el desfase en días hábiles:
   - `FS`: `inicioMinimo >= sumarDiasHabiles(finPredecesora, desfase + 1, calendario)`
   - `SS`: `inicioMinimo >= sumarDiasHabiles(inicioPredecesora, desfase, calendario)`
   - `FF`: `finMinimo >= sumarDiasHabiles(finPredecesora, desfase, calendario)` $\to$ `inicioMinimo >= finDesdeInverso(finMinimo, duracion, calendario)`
   - `SF`: `finMinimo >= sumarDiasHabiles(inicioPredecesora, desfase - 1, calendario)` $\to$ `inicioMinimo >= finDesdeInverso(finMinimo, duracion, calendario)`

2. **Detección del inicio mínimo admisible**:
   Para validar si un arrastre es legal, se invoca `preverInicioTarea` con `fechaFija: null`. Si la fecha de inicio propuesta por el usuario es estrictamente anterior al inicio planificado calculado, la acción es rechazada localmente en el cliente:
   - Se cancela la mutación HTTP (`PATCH`).
   - La barra retorna a su posición geométrica previa (reversión visual).
   - Se emite una notificación de advertencia detallando la restricción limitante (por ejemplo: _"No se puede mover antes del 09-11-2026 por dependencia SS +2 con 1.1.2"_).

---

## 6. Matriz de Bloqueos de Interacción y Edición

La interfaz protege la integridad de los datos mediante una matriz estricta de bloqueos según el estado y rol:

| Condición                              | Desplazamiento (`fechaFija`) | Redimensionamiento (`duracionDias`) | Causa / Mensaje de Bloqueo                                                                            |
| :------------------------------------- | :--------------------------- | :---------------------------------- | :---------------------------------------------------------------------------------------------------- |
| **Rol Lector (`CC`)**                  | Bloqueado                    | Bloqueado                           | Solo lectura; sin asas de arrastre ni atributos interactivos. Peticiones directas devuelven HTTP 403. |
| **Tarea Resumen (Etapa / Actividad)**  | Bloqueado                    | Bloqueado                           | Sus fechas y duraciones se calculan automáticamente a partir de sus subactividades hijas.             |
| **Tarea con `inicioReal` registrado**  | Bloqueado                    | Permitido (solo asa derecha)        | El inicio ya ocurrió en la realidad y queda fijo; la duración restante o total puede ajustarse.       |
| **Movimiento anterior a dependencias** | Bloqueado (Reversión)        | N/A                                 | Viola la fecha mínima impuesta por relaciones de precedencia entrantes.                               |
| **Duración propuesta $< 1$ día hábil** | N/A                          | Bloqueado (Mínimo 1)                | La duración mínima admisible para cualquier tarea es de 1 día hábil.                                  |
| **Proyecto Cerrado**                   | Bloqueado                    | Bloqueado                           | Banner informativo; mutaciones bloqueadas tanto en interfaz como con HTTP 409 en el servidor.         |

---

## 7. Prioridad Visual y Semántica de Capas

El SVG de la carta Gantt renderiza sus elementos en un orden estricto de capas (de fondo a frente) para asegurar legibilidad:

1. **Fondo de grilla y fines de semana**: Franjas sombreadas para sábados, domingos y feriados nacionales.
2. **Línea vertical de "Hoy"**: Trazado destacado indicando la fecha de ejecución.
3. **Barras de Línea Base**: Barras delgadas grises (4 px) ubicadas en la parte inferior de la fila cuando el interruptor de línea base está activo.
4. **Flechas de dependencias**: Trazos ortogonales con marcadores triangulares. Destacadas en color carmesí si pertenecen a la ruta crítica activa.
5. **Barras de tareas planificadas**:
   - Barras de resumen: Grises oscuras con remates triangulares hacia abajo en los extremos.
   - Barras de hojas normales: Tonos azules primarios, divididas entre la porción de avance completado y pendiente.
   - Barras de hojas críticas: Tonos carmesí / rojizos cuando la opción de ruta crítica está habilitada.
   - Barras de hojas atrasadas: Tonos de alerta anaranjados / rojizos cuando la tarea no está cumplida y su fecha fin planificada ya venció respecto de hoy.
6. **Rombos de hitos**: Rombos girados a 45 grados posicionados en su fecha objetivo, coloreados según su estado derivado (`CUMPLIDO`, `PENDIENTE`, `EN_RIESGO`, `ATRASADO`).
7. **Barra fantasma interactiva**: Guía visual translúcida proyectada durante la operación de arrastre.

---

## 8. Exportación Gráfica (PNG y PDF) sin Dependencia Externa

El subsistema de exportación genera capturas fieles del diagrama visible sin requerir acceso a internet:

1. **Recorte y clonación del SVG**: Se clona el elemento SVG clonando únicamente los elementos presentes en el área del proyecto, estableciendo `viewBox` y dimensiones exactas.
2. **Incrustación de fuentes locales**: Para evitar fallos de renderizado de texto en `canvas` o en navegadores sin tipografía instalada, se inyecta dinámicamente un bloque `<style>` con la fuente `@fontsource-variable/inter` codificada en Base64 leída desde los recursos locales empaquetados.
3. **Generación PNG**: El SVG estilizado se serializa a XML, se carga en un elemento `HTMLImageElement` auxiliar y se dibuja sobre un `HTMLCanvasElement` antes de exportar el blob en formato `image/png`.
4. **Generación PDF**: Mediante la biblioteca `jspdf` (versión 4.2.1, licencia MIT), se crea un documento vectorial apaisado dimensionado proporcionalmente al diagrama, renderizando la imagen generada con márgenes limpios y nombre estandarizado `gantt-<proyecto>-<fecha>.pdf`.
