# AutoFix Gestión

Sistema de planificación, seguimiento y gestión del cambio: proyectos, tareas jerárquicas, Carta Gantt con dependencias FS/SS/FF/SF, recursos y costos, hitos, KPI configurables, gestión del cambio en 10 etapas y dos tableros de comando.

## Inicio rápido (para evaluar)

Requisito único: [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y en ejecución.

| Sistema     | Iniciar                        | Volver a los datos iniciales | Apagar         |
| ----------- | ------------------------------ | ---------------------------- | -------------- |
| Windows     | doble clic en `iniciar.bat`    | `reiniciar-datos.bat`        | `detener.bat`  |
| Mac / Linux | `./iniciar.sh` en una terminal | `./reiniciar-datos.sh`       | `./detener.sh` |

El script crea el archivo `.env`, construye y levanta los contenedores, aplica las migraciones, carga el caso de prueba **AutoFix Gestión · Piloto 3 sucursales** y abre http://localhost:5173. La primera ejecución tarda entre 5 y 10 minutos porque descarga dependencias; las siguientes, menos de un minuto.

La fecha de corte del sistema es fija (`FECHA_CORTE=2026-11-16` en `.env`) para que los indicadores, atrasos y valores de la demostración sean siempre los mismos. Se eligen dos roles con el selector superior: **JP** (Jefe de Proyecto) y **CC** (Comité de Cambios).

## Estructura

```
apps/
  api/    API REST (NestJS)
  web/    Frontend (React + Vite)
packages/
  core/   Lógica de dominio pura y compartida (cronograma, costos, KPI, esquemas)
docs/     Plan del sprint y documentación técnica
```

## Levantar con Docker

Requisito: Docker Desktop.

```bash
cp .env.example .env
docker compose up --build
```

| Servicio | URL                         | Descripción                                |
| -------- | --------------------------- | ------------------------------------------ |
| web      | http://localhost:5173       | Frontend con recarga en caliente           |
| api      | http://localhost:3000/salud | Estado de la API y de la base de datos     |
| adminer  | http://localhost:8088       | Cliente web de PostgreSQL (servidor `db`)  |
| db       | `localhost:5432`            | PostgreSQL 16 (usuario/clave/BD en `.env`) |

Los datos de PostgreSQL viven en el volumen `autofix_pgdata` y sobreviven a `docker compose down`. Para borrarlos: `docker compose down -v`.

Al editar archivos en `apps/` o `packages/`, la API y la web se recargan solas (por sondeo de archivos, compatible con Windows).

Si cambian las dependencias (`pnpm-lock.yaml`), reconstruir renovando los volúmenes de `node_modules`:

```bash
docker compose up --build -V
```

## Base de datos

El esquema vive en `apps/api/prisma/schema.prisma` y está documentado en [docs/modelo-datos.md](docs/modelo-datos.md). Al arrancar, la API aplica sola las migraciones pendientes.

Con el stack levantado, desde la raíz:

| Comando           | Qué hace                                                             |
| ----------------- | -------------------------------------------------------------------- |
| `pnpm db:migrate` | Crea y aplica una migración nueva tras editar el schema              |
| `pnpm db:deploy`  | Aplica las migraciones pendientes                                    |
| `pnpm db:reset`   | Borra la BD, aplica todas las migraciones y ejecuta el seed          |
| `pnpm db:seed`    | Ejecuta solo el seed                                                 |
| `pnpm db:erd`     | Regenera el diagrama y las tablas de `docs/modelo-datos.md` (sin BD) |

## Desarrollo sin Docker

Requisitos: Node.js 22 (ver `.nvmrc`) y pnpm 10 (`npm install -g pnpm@10`).

## Comandos

| Comando          | Qué hace                                         |
| ---------------- | ------------------------------------------------ |
| `pnpm install`   | Instala las dependencias de todo el monorepo     |
| `pnpm build`     | Compila `core`, luego `api` y `web`              |
| `pnpm lint`      | ESLint + verificación de formato con Prettier    |
| `pnpm format`    | Formatea el código con Prettier                  |
| `pnpm test`      | Ejecuta los tests (Vitest) de todos los paquetes |
| `pnpm typecheck` | Verifica tipos sin compilar                      |

Desarrollo por paquete: `pnpm --filter @autofix/api dev` (requiere `DATABASE_URL`), `pnpm --filter @autofix/web dev`.

## Planificación y convenciones

El plan del sprint está en [docs/SPRINT_01.md](docs/SPRINT_01.md) y las convenciones de rutas, cabeceras, roles y formato de errores se detallan en [docs/convenciones-api.md](docs/convenciones-api.md).

## Uso sin conexión

El sistema está diseñado para operar en un equipo local completamente desconectado de internet:

1. **Construcción previa con conexión**: Los contenedores y dependencias se construyen inicialmente con acceso a la red:
   ```bash
   docker compose up --build -V
   ```
2. **Ejecución y demostración sin red**: En operación offline o demostraciones, levantar los servicios existentes **sin** los modificadores `--build` ni `-V`:
   ```bash
   docker compose up
   ```
3. **Advertencia de reconstrucción sin conexión**: Si se ejecuta `docker compose up --build` sin acceso a internet tras modificar dependencias en algún `package.json`, el proceso fallará al no poder descargar paquetes del registro npm.
4. **Persistencia local e integridad**:
   - Todo recurso visual (tipografía Inter Variable, íconos Tabler, estilos CSS de Mantine) está empaquetado localmente en el bundle generado por Vite, sin llamadas a CDNs externas.
   - La variable `CHECKPOINT_DISABLE: '1'` en el servicio `api` desactiva las comprobaciones de versión en línea de Prisma al ejecutar `prisma generate` durante el arranque.
   - Si se eliminan los volúmenes con `docker compose down -v` sin conexión, las imágenes construidas se conservan localmente; el sistema levanta normalmente y basta ejecutar `pnpm db:reset` para recrear las tablas y sembrar los datos iniciales.
