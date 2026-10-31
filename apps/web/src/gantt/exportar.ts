import urlInter from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';
import { diasCorridosEntre, formatearFecha, sumarDiasCorridos } from '@autofix/core';
import { ALTO_FILA, type Escala, type NivelZoom } from './escala';
import type { ModeloGantt } from './modelo-gantt';
import type { PaletaGantt } from './paleta-gantt';

export const ANCHO_GRILLA = 460;
export const ALTO_ENCABEZADO = 48;

export interface VentanaVisible {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

export function ventanaVisible(contenedor: HTMLDivElement): VentanaVisible {
  return {
    x: contenedor.scrollLeft,
    y: contenedor.scrollTop,
    ancho: Math.max(1, contenedor.clientWidth - ANCHO_GRILLA),
    alto: Math.max(1, contenedor.clientHeight - ALTO_ENCABEZADO),
  };
}

export interface EtiquetaEncabezado {
  x: number;
  ancho: number;
  texto: string;
}

const MESES_CORTO = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

export function etiquetasEncabezado(
  escala: Escala,
  zoom: NivelZoom,
  xDesde: number,
  xHasta: number,
): EtiquetaEncabezado[] {
  const totalDias = diasCorridosEntre(escala.rango.inicio, escala.rango.fin);
  const resultado: EtiquetaEncabezado[] = [];

  if (zoom === 'DIA') {
    for (let i = 0; i <= totalDias; i += 1) {
      const fecha = sumarDiasCorridos(escala.rango.inicio, i);
      const x = escala.xDe(fecha);
      const ancho = escala.pxPorDia;
      if (x + ancho > xDesde && x < xHasta) {
        const dia = String(Number(fecha.split('-')[2]));
        resultado.push({ x, ancho, texto: dia });
      }
    }
  } else if (zoom === 'SEMANA') {
    for (let i = 0; i <= totalDias; i += 1) {
      const fecha = sumarDiasCorridos(escala.rango.inicio, i);
      const [anio, mes, dia] = fecha.split('-').map(Number);
      const diaSemana = new Date(Date.UTC(anio!, mes! - 1, dia!)).getUTCDay();
      if (diaSemana === 1 || i === 0) {
        const x = escala.xDe(fecha);
        const diasRestantes = Math.min(7, totalDias - i + 1);
        const ancho = diasRestantes * escala.pxPorDia;
        if (x + ancho > xDesde && x < xHasta) {
          resultado.push({ x, ancho, texto: String(dia) });
        }
      }
    }
  } else {
    let mesActual: number | null = null;
    let anioActual: number | null = null;
    let xInicioMes = 0;

    for (let i = 0; i <= totalDias; i += 1) {
      const fecha = sumarDiasCorridos(escala.rango.inicio, i);
      const [anioStr, mesStr] = fecha.split('-');
      const anio = Number(anioStr);
      const mes = Number(mesStr) - 1;
      const x = escala.xDe(fecha);

      if (mesActual === null) {
        mesActual = mes;
        anioActual = anio;
        xInicioMes = x;
      } else if (mes !== mesActual) {
        const ancho = x - xInicioMes;
        if (xInicioMes + ancho > xDesde && xInicioMes < xHasta) {
          resultado.push({
            x: xInicioMes,
            ancho,
            texto: `${MESES_CORTO[mesActual]!} ${anioActual}`,
          });
        }
        mesActual = mes;
        anioActual = anio;
        xInicioMes = x;
      }
    }

    if (mesActual !== null) {
      const ancho = escala.ancho - xInicioMes;
      if (xInicioMes + ancho > xDesde && xInicioMes < xHasta) {
        resultado.push({
          x: xInicioMes,
          ancho,
          texto: `${MESES_CORTO[mesActual]!} ${anioActual}`,
        });
      }
    }
  }

  return resultado;
}

export function nombreArchivo(nombreProyecto: string, extension: string): string {
  const normalizado = nombreProyecto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `gantt-${normalizado || 'proyecto'}.${extension}`;
}

export function componerSvgExportacion(
  svgBarras: SVGSVGElement,
  modelo: ModeloGantt,
  ventana: VentanaVisible,
  paleta: PaletaGantt,
  zoom: NivelZoom,
): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const raiz = document.createElementNS(ns, 'svg');
  const anchoTotal = ANCHO_GRILLA + ventana.ancho;
  const altoTotal = ALTO_ENCABEZADO + ventana.alto;

  raiz.setAttribute('xmlns', ns);
  raiz.setAttribute('width', String(anchoTotal));
  raiz.setAttribute('height', String(altoTotal));
  raiz.setAttribute('viewBox', `0 0 ${anchoTotal} ${altoTotal}`);
  raiz.setAttribute('style', "font-family: 'Inter Variable', sans-serif;");
  raiz.setAttribute('font-family', "'Inter Variable', sans-serif");

  const rectFondo = document.createElementNS(ns, 'rect');
  rectFondo.setAttribute('x', '0');
  rectFondo.setAttribute('y', '0');
  rectFondo.setAttribute('width', String(anchoTotal));
  rectFondo.setAttribute('height', String(altoTotal));
  rectFondo.setAttribute('fill', paleta.fondo);
  raiz.appendChild(rectFondo);

  const rectGrilla = document.createElementNS(ns, 'rect');
  rectGrilla.setAttribute('x', '0');
  rectGrilla.setAttribute('y', '0');
  rectGrilla.setAttribute('width', String(ANCHO_GRILLA));
  rectGrilla.setAttribute('height', String(altoTotal));
  rectGrilla.setAttribute('fill', paleta.fondoGrilla);
  raiz.appendChild(rectGrilla);

  const rectEncGrilla = document.createElementNS(ns, 'rect');
  rectEncGrilla.setAttribute('x', '0');
  rectEncGrilla.setAttribute('y', '0');
  rectEncGrilla.setAttribute('width', String(ANCHO_GRILLA));
  rectEncGrilla.setAttribute('height', String(ALTO_ENCABEZADO));
  rectEncGrilla.setAttribute('fill', paleta.fondoEncabezado);
  raiz.appendChild(rectEncGrilla);

  const lineaEncGrilla = document.createElementNS(ns, 'line');
  lineaEncGrilla.setAttribute('x1', '0');
  lineaEncGrilla.setAttribute('y1', String(ALTO_ENCABEZADO));
  lineaEncGrilla.setAttribute('x2', String(ANCHO_GRILLA));
  lineaEncGrilla.setAttribute('y2', String(ALTO_ENCABEZADO));
  lineaEncGrilla.setAttribute('stroke', paleta.bordeEncabezado);
  lineaEncGrilla.setAttribute('stroke-width', '1');
  raiz.appendChild(lineaEncGrilla);

  const columnasEnc = [
    { texto: 'Código', x: 16 },
    { texto: 'Nombre', x: 80 },
    { texto: 'Dur.', x: 270 },
    { texto: 'Inicio', x: 330 },
    { texto: 'Fin', x: 395 },
  ];
  for (const col of columnasEnc) {
    const t = document.createElementNS(ns, 'text');
    t.setAttribute('x', String(col.x));
    t.setAttribute('y', '28');
    t.setAttribute('font-size', '11');
    t.setAttribute('font-weight', '600');
    t.setAttribute('fill', paleta.textoAtenuado);
    t.textContent = col.texto;
    raiz.appendChild(t);
  }

  for (const fila of modelo.filas) {
    if (fila.y + ALTO_FILA >= ventana.y && fila.y <= ventana.y + ventana.alto) {
      const py = ALTO_ENCABEZADO + fila.y - ventana.y;

      const sep = document.createElementNS(ns, 'line');
      sep.setAttribute('x1', '0');
      sep.setAttribute('y1', String(py + ALTO_FILA));
      sep.setAttribute('x2', String(ANCHO_GRILLA));
      sep.setAttribute('y2', String(py + ALTO_FILA));
      sep.setAttribute('stroke', paleta.borde);
      sep.setAttribute('stroke-width', '1');
      raiz.appendChild(sep);

      const baseline = py + ALTO_FILA / 2 + 4;

      const tCod = document.createElementNS(ns, 'text');
      tCod.setAttribute('x', '16');
      tCod.setAttribute('y', String(baseline));
      tCod.setAttribute('font-size', '11');
      tCod.setAttribute('font-weight', fila.esResumen ? '700' : '500');
      tCod.setAttribute('fill', paleta.texto);
      tCod.textContent = fila.tarea.codigo;
      raiz.appendChild(tCod);

      const nombreTexto =
        fila.tarea.nombre.length > 28 ? `${fila.tarea.nombre.slice(0, 28)}…` : fila.tarea.nombre;
      const tNom = document.createElementNS(ns, 'text');
      tNom.setAttribute('x', '80');
      tNom.setAttribute('y', String(baseline));
      tNom.setAttribute('font-size', '11');
      tNom.setAttribute('font-weight', fila.esResumen ? '700' : '400');
      tNom.setAttribute('fill', paleta.texto);
      tNom.textContent = nombreTexto;
      raiz.appendChild(tNom);

      const tDur = document.createElementNS(ns, 'text');
      tDur.setAttribute('x', '270');
      tDur.setAttribute('y', String(baseline));
      tDur.setAttribute('font-size', '11');
      tDur.setAttribute('fill', paleta.textoAtenuado);
      tDur.textContent = `${fila.tarea.duracionDias} d`;
      raiz.appendChild(tDur);

      const tIni = document.createElementNS(ns, 'text');
      tIni.setAttribute('x', '330');
      tIni.setAttribute('y', String(baseline));
      tIni.setAttribute('font-size', '11');
      tIni.setAttribute('fill', paleta.textoAtenuado);
      tIni.textContent = formatearFecha(fila.tarea.inicioPlan);
      raiz.appendChild(tIni);

      const tFin = document.createElementNS(ns, 'text');
      tFin.setAttribute('x', '395');
      tFin.setAttribute('y', String(baseline));
      tFin.setAttribute('font-size', '11');
      tFin.setAttribute('fill', paleta.textoAtenuado);
      tFin.textContent = formatearFecha(fila.tarea.finPlan);
      raiz.appendChild(tFin);
    }
  }

  const bordeDivisorio = document.createElementNS(ns, 'line');
  bordeDivisorio.setAttribute('x1', String(ANCHO_GRILLA));
  bordeDivisorio.setAttribute('y1', '0');
  bordeDivisorio.setAttribute('x2', String(ANCHO_GRILLA));
  bordeDivisorio.setAttribute('y2', String(altoTotal));
  bordeDivisorio.setAttribute('stroke', paleta.borde);
  bordeDivisorio.setAttribute('stroke-width', '1');
  raiz.appendChild(bordeDivisorio);

  const rectEncTiempo = document.createElementNS(ns, 'rect');
  rectEncTiempo.setAttribute('x', String(ANCHO_GRILLA));
  rectEncTiempo.setAttribute('y', '0');
  rectEncTiempo.setAttribute('width', String(ventana.ancho));
  rectEncTiempo.setAttribute('height', String(ALTO_ENCABEZADO));
  rectEncTiempo.setAttribute('fill', paleta.fondoEncabezado);
  raiz.appendChild(rectEncTiempo);

  const lineaEncTiempo = document.createElementNS(ns, 'line');
  lineaEncTiempo.setAttribute('x1', String(ANCHO_GRILLA));
  lineaEncTiempo.setAttribute('y1', String(ALTO_ENCABEZADO));
  lineaEncTiempo.setAttribute('x2', String(anchoTotal));
  lineaEncTiempo.setAttribute('y2', String(ALTO_ENCABEZADO));
  lineaEncTiempo.setAttribute('stroke', paleta.bordeEncabezado);
  lineaEncTiempo.setAttribute('stroke-width', '1');
  raiz.appendChild(lineaEncTiempo);

  const etiquetas = etiquetasEncabezado(modelo.escala, zoom, ventana.x, ventana.x + ventana.ancho);
  for (const et of etiquetas) {
    const sx = ANCHO_GRILLA + et.x - ventana.x;
    const t = document.createElementNS(ns, 'text');
    t.setAttribute('x', String(sx + et.ancho / 2));
    t.setAttribute('y', String(ALTO_ENCABEZADO / 2 + 4));
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('font-size', '11');
    t.setAttribute('font-weight', '500');
    t.setAttribute('fill', paleta.texto);
    t.textContent = et.texto;
    raiz.appendChild(t);
  }

  const svgAnidado = document.createElementNS(ns, 'svg');
  svgAnidado.setAttribute('x', String(ANCHO_GRILLA));
  svgAnidado.setAttribute('y', String(ALTO_ENCABEZADO));
  svgAnidado.setAttribute('width', String(ventana.ancho));
  svgAnidado.setAttribute('height', String(ventana.alto));
  svgAnidado.setAttribute('viewBox', `${ventana.x} ${ventana.y} ${ventana.ancho} ${ventana.alto}`);

  for (const hijo of Array.from(svgBarras.childNodes)) {
    svgAnidado.appendChild(hijo.cloneNode(true));
  }
  raiz.appendChild(svgAnidado);

  return raiz;
}

let fuenteBase64Cache: string | null = null;

async function obtenerFuenteInterBase64(): Promise<string> {
  if (fuenteBase64Cache) return fuenteBase64Cache;
  const respuesta = await fetch(urlInter);
  const blob = await respuesta.blob();
  const buffer = await blob.arrayBuffer();
  let binario = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binario += String.fromCharCode(bytes[i]!);
  }
  const base64 = btoa(binario);
  fuenteBase64Cache = `data:font/woff2;base64,${base64}`;
  return fuenteBase64Cache;
}

export async function exportarPng(
  svg: SVGSVGElement,
  modelo: ModeloGantt,
  ventana: VentanaVisible,
  paleta: PaletaGantt,
  zoom: NivelZoom,
  _nombreProyecto: string,
): Promise<Blob> {
  void _nombreProyecto;
  const compuesto = componerSvgExportacion(svg, modelo, ventana, paleta, zoom);
  try {
    const fuente = await obtenerFuenteInterBase64();
    const estilo = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    estilo.textContent = `@font-face { font-family: 'Inter Variable'; src: url('${fuente}') format('woff2'); font-weight: 100 900; font-style: normal; }`;
    compuesto.insertBefore(estilo, compuesto.firstChild);
  } catch (_error) {
    void _error;
  }

  const anchoTotal = ANCHO_GRILLA + ventana.ancho;
  const altoTotal = ALTO_ENCABEZADO + ventana.alto;

  const xml = new XMLSerializer().serializeToString(compuesto);
  const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const imagen = new Image();
  await new Promise<void>((resolver, rechazar) => {
    imagen.onload = () => resolver();
    imagen.onerror = (e) => rechazar(e);
    imagen.src = url;
  });

  const escalaDpi = 2;
  const canvas = document.createElement('canvas');
  canvas.width = anchoTotal * escalaDpi;
  canvas.height = altoTotal * escalaDpi;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo obtener el contexto 2D del canvas.');

  ctx.scale(escalaDpi, escalaDpi);
  ctx.drawImage(imagen, 0, 0, anchoTotal, altoTotal);
  URL.revokeObjectURL(url);

  return new Promise<Blob>((resolver, rechazar) => {
    canvas.toBlob((blob) => {
      if (blob) resolver(blob);
      else rechazar(new Error('No se pudo generar el blob PNG.'));
    }, 'image/png');
  });
}

export function descargarBlob(blob: Blob, nombre: string): void {
  const enlace = document.createElement('a');
  const url = URL.createObjectURL(blob);
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}

export async function exportarPdf(
  svg: SVGSVGElement,
  modelo: ModeloGantt,
  ventana: VentanaVisible,
  paleta: PaletaGantt,
  zoom: NivelZoom,
  nombreProyecto: string,
  fechaHoy: string,
): Promise<Blob> {
  const blobPng = await exportarPng(svg, modelo, ventana, paleta, zoom, nombreProyecto);
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const anchoPagina = doc.internal.pageSize.getWidth();
  const altoPagina = doc.internal.pageSize.getHeight();
  const margen = 10;
  const altoCabecera = 12;

  doc.setFontSize(14);
  doc.text(nombreProyecto, margen, margen + 4);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Fecha: ${fechaHoy}`, anchoPagina - margen - 35, margen + 4);

  const reader = new FileReader();
  const base64Data = await new Promise<string>((resolver) => {
    reader.onloadend = () => resolver(reader.result as string);
    reader.readAsDataURL(blobPng);
  });

  const areaDisponibleAncho = anchoPagina - margen * 2;
  const areaDisponibleAlto = altoPagina - margen * 2 - altoCabecera;

  const anchoTotal = ANCHO_GRILLA + ventana.ancho;
  const altoTotal = ALTO_ENCABEZADO + ventana.alto;
  const proporcion = anchoTotal / altoTotal;
  let anchoImg = areaDisponibleAncho;
  let altoImg = anchoImg / proporcion;

  if (altoImg > areaDisponibleAlto) {
    altoImg = areaDisponibleAlto;
    anchoImg = altoImg * proporcion;
  }

  doc.addImage(
    base64Data,
    'PNG',
    margen,
    margen + altoCabecera,
    anchoImg,
    altoImg,
    undefined,
    'FAST',
  );
  return doc.output('blob');
}
