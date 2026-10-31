import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME } from '@mantine/core';
import {
  crearCalendarioLaboral,
  DIAS_LABORABLES_POR_DEFECTO,
  type TareaArbol,
} from '@autofix/core';
import { crearEscala } from './escala';
import {
  componerSvgExportacion,
  etiquetasEncabezado,
  nombreArchivo,
  ventanaVisible,
} from './exportar';
import { construirModeloGantt } from './modelo-gantt';
import { resolverPaletaGantt } from './paleta-gantt';

describe('exportar', () => {
  const paleta = resolverPaletaGantt(DEFAULT_THEME, 'light');

  const calendario = crearCalendarioLaboral({
    diasLaborables: DIAS_LABORABLES_POR_DEFECTO,
    feriados: [],
  });

  const crearTarea = (
    id: number,
    codigo: string,
    padreId: number | null,
    nombre: string,
    duracionDias: number,
    inicioPlan: string,
    finPlan: string,
    tieneHijas: boolean,
  ): TareaArbol => ({
    id,
    codigo,
    padreId,
    nombre,
    descripcion: null,
    responsable: 'Responsable',
    duracionDias,
    porcentajeAvance: 0,
    inicioPlan,
    finPlan,
    inicioTardio: inicioPlan,
    finTardio: finPlan,
    holguraDias: 0,
    esCritica: true,
    fechaFija: null,
    inicioReal: null,
    finReal: null,
    nivel: padreId === null ? 'ETAPA' : tieneHijas ? 'ACTIVIDAD' : 'SUBACTIVIDAD',
    orden: id,
    tieneHijas,
  });

  const tareas = [
    crearTarea(1, '1', null, 'Levantamiento y diseño', 12, '2026-11-02', '2026-11-17', true),
    crearTarea(5, '1.2', 1, 'Diseño de la solución', 7, '2026-11-09', '2026-11-17', true),
    crearTarea(6, '1.2.1', 5, 'Modelo de datos de vehículos', 5, '2026-11-09', '2026-11-13', false),
  ];

  it('normaliza el nombre de archivo eliminando tildes y caracteres especiales', () => {
    expect(nombreArchivo('AutoFix · Implementación', 'png')).toBe(
      'gantt-autofix-implementacion.png',
    );
    expect(nombreArchivo('Plan de Trabajo & Soporte / Taller 2026', 'pdf')).toBe(
      'gantt-plan-de-trabajo-soporte-taller-2026.pdf',
    );
    expect(nombreArchivo('', 'png')).toBe('gantt-proyecto.png');
  });

  it('ventanaVisible calcula coordenadas considerando ancho de grilla y alto de encabezado', () => {
    const contenedor = {
      scrollLeft: 700,
      scrollTop: 0,
      clientWidth: 636,
      clientHeight: 552,
    } as unknown as HTMLDivElement;

    const v = ventanaVisible(contenedor);
    expect(v).toEqual({
      x: 700,
      y: 0,
      ancho: 176,
      alto: 504,
    });
  });

  it('etiquetasEncabezado genera etiquetas en los 3 zooms', () => {
    const escalaDia = crearEscala({ inicio: '2026-11-02', fin: '2026-11-10' }, 32);
    const etDia = etiquetasEncabezado(escalaDia, 'DIA', 0, 100);
    expect(etDia.length).toBeGreaterThan(0);
    expect(etDia[0]?.texto).toBe('2');

    const escalaSemana = crearEscala({ inicio: '2026-11-02', fin: '2026-11-30' }, 12);
    const etSemana = etiquetasEncabezado(escalaSemana, 'SEMANA', 0, 200);
    expect(etSemana.length).toBeGreaterThan(0);
    expect(etSemana[0]?.texto).toBe('2');

    const escalaMes = crearEscala({ inicio: '2026-11-01', fin: '2026-12-31' }, 4);
    const etMes = etiquetasEncabezado(escalaMes, 'MES', 0, 300);
    expect(etMes.length).toBe(2);
    expect(etMes[0]?.texto).toBe('Nov 2026');
    expect(etMes[1]?.texto).toBe('Dic 2026');
  });

  it('componerSvgExportacion compone grilla, encabezado y viewBox del svg anidado', () => {
    const modelo = construirModeloGantt({
      tareas,
      colapsadas: new Set(),
      dependencias: [],
      hitos: [],
      lineaBase: null,
      calendario,
      hoy: '2026-10-31',
      zoom: 'DIA',
      rutaCriticaActiva: false,
    });

    const svgBarras = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '720');
    rect.setAttribute('y', '30');
    svgBarras.appendChild(rect);

    const ventana = { x: 700, y: 0, ancho: 176, alto: 504 };
    const compuesto = componerSvgExportacion(svgBarras, modelo, ventana, paleta, 'DIA');

    expect(compuesto.getAttribute('font-family')).toBe("'Inter Variable', sans-serif");

    const xml = new XMLSerializer().serializeToString(compuesto);
    expect(xml).toContain('1.2.1');
    expect(xml).toContain('Modelo de datos');
    expect(xml).toContain('viewBox="700 0 176 504"');
  });
});
