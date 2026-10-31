import { memo, useMemo } from 'react';
import { diasCorridosEntre, sumarDiasCorridos } from '@autofix/core';
import type { Escala, NivelZoom } from './escala';
import { ALTO_ENCABEZADO } from './exportar';
import type { PaletaGantt } from './paleta-gantt';

interface EncabezadoTiempoProps {
  escala: Escala;
  zoom: NivelZoom;
  paleta: PaletaGantt;
  anchoGrilla: number;
}

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

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

export const EncabezadoTiempo = memo(function EncabezadoTiempo({
  escala,
  zoom,
  paleta,
  anchoGrilla,
}: EncabezadoTiempoProps) {
  const { superior, inferior } = useMemo(() => {
    const totalDias = diasCorridosEntre(escala.rango.inicio, escala.rango.fin);
    const bloquesSuperior: Array<{ x: number; ancho: number; texto: string }> = [];
    const bloquesInferior: Array<{ x: number; ancho: number; texto: string }> = [];

    if (zoom === 'MES') {
      let anioActual: number | null = null;
      let xInicioAnio = 0;
      let mesActual: number | null = null;
      let xInicioMes = 0;

      for (let i = 0; i <= totalDias; i += 1) {
        const fechaIso = sumarDiasCorridos(escala.rango.inicio, i);
        const [anioStr, mesStr] = fechaIso.split('-');
        const anio = Number(anioStr);
        const mes = Number(mesStr) - 1;
        const x = escala.xDe(fechaIso);

        if (anioActual === null) {
          anioActual = anio;
          xInicioAnio = x;
        } else if (anio !== anioActual) {
          bloquesSuperior.push({
            x: xInicioAnio,
            ancho: x - xInicioAnio,
            texto: String(anioActual),
          });
          anioActual = anio;
          xInicioAnio = x;
        }

        if (mesActual === null) {
          mesActual = mes;
          xInicioMes = x;
        } else if (mes !== mesActual) {
          bloquesInferior.push({
            x: xInicioMes,
            ancho: x - xInicioMes,
            texto: MESES_CORTO[mesActual]!,
          });
          mesActual = mes;
          xInicioMes = x;
        }
      }

      if (anioActual !== null) {
        bloquesSuperior.push({
          x: xInicioAnio,
          ancho: escala.ancho - xInicioAnio,
          texto: String(anioActual),
        });
      }
      if (mesActual !== null) {
        bloquesInferior.push({
          x: xInicioMes,
          ancho: escala.ancho - xInicioMes,
          texto: MESES_CORTO[mesActual]!,
        });
      }
    } else if (zoom === 'SEMANA') {
      let claveMesActual: string | null = null;
      let xInicioMes = 0;
      let textoMesActual = '';

      for (let i = 0; i <= totalDias; i += 1) {
        const fechaIso = sumarDiasCorridos(escala.rango.inicio, i);
        const [anioStr, mesStr, diaStr] = fechaIso.split('-');
        const anio = Number(anioStr);
        const mes = Number(mesStr) - 1;
        const clave = `${anio}-${mes}`;
        const x = escala.xDe(fechaIso);
        const d = new Date(`${fechaIso}T00:00:00.000Z`);
        const diaSemana = d.getUTCDay();

        if (claveMesActual === null) {
          claveMesActual = clave;
          xInicioMes = x;
          textoMesActual = `${MESES[mes]} ${anio}`;
        } else if (clave !== claveMesActual) {
          bloquesSuperior.push({
            x: xInicioMes,
            ancho: x - xInicioMes,
            texto: textoMesActual,
          });
          claveMesActual = clave;
          xInicioMes = x;
          textoMesActual = `${MESES[mes]} ${anio}`;
        }

        if (diaSemana === 1 || i === 0) {
          const diasRestantes = Math.min(7, totalDias - i + 1);
          bloquesInferior.push({
            x,
            ancho: diasRestantes * escala.pxPorDia,
            texto: diaStr!,
          });
        }
      }

      if (claveMesActual !== null) {
        bloquesSuperior.push({
          x: xInicioMes,
          ancho: escala.ancho - xInicioMes,
          texto: textoMesActual,
        });
      }
    } else {
      let claveMesActual: string | null = null;
      let xInicioMes = 0;
      let textoMesActual = '';

      for (let i = 0; i <= totalDias; i += 1) {
        const fechaIso = sumarDiasCorridos(escala.rango.inicio, i);
        const [anioStr, mesStr, diaStr] = fechaIso.split('-');
        const anio = Number(anioStr);
        const mes = Number(mesStr) - 1;
        const clave = `${anio}-${mes}`;
        const x = escala.xDe(fechaIso);

        if (claveMesActual === null) {
          claveMesActual = clave;
          xInicioMes = x;
          textoMesActual = `${MESES[mes]} ${anio}`;
        } else if (clave !== claveMesActual) {
          bloquesSuperior.push({
            x: xInicioMes,
            ancho: x - xInicioMes,
            texto: textoMesActual,
          });
          claveMesActual = clave;
          xInicioMes = x;
          textoMesActual = `${MESES[mes]} ${anio}`;
        }

        bloquesInferior.push({
          x,
          ancho: escala.pxPorDia,
          texto: diaStr!,
        });
      }

      if (claveMesActual !== null) {
        bloquesSuperior.push({
          x: xInicioMes,
          ancho: escala.ancho - xInicioMes,
          texto: textoMesActual,
        });
      }
    }

    return { superior: bloquesSuperior, inferior: bloquesInferior };
  }, [escala, zoom]);

  return (
    <div
      style={{
        display: 'flex',
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: paleta.fondoEncabezado,
        borderBottom: `1px solid ${paleta.bordeEncabezado}`,
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: anchoGrilla,
          minWidth: anchoGrilla,
          maxWidth: anchoGrilla,
          position: 'sticky',
          left: 0,
          zIndex: 30,
          background: paleta.fondoEncabezado,
          borderRight: `1px solid ${paleta.bordeEncabezado}`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          height: ALTO_ENCABEZADO,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '70px 190px 60px 70px 70px',
            fontSize: 12,
            fontWeight: 600,
            color: paleta.texto,
            padding: '4px 8px',
          }}
        >
          <div>Código</div>
          <div>Nombre</div>
          <div style={{ textAlign: 'right' }}>Dur.</div>
          <div style={{ textAlign: 'center' }}>Inicio</div>
          <div style={{ textAlign: 'center' }}>Fin</div>
        </div>
      </div>

      <div style={{ width: escala.ancho, position: 'relative', height: ALTO_ENCABEZADO }}>
        <div
          style={{
            height: 24,
            position: 'relative',
            borderBottom: `1px solid ${paleta.borde}`,
          }}
        >
          {superior.map((b, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: b.x,
                width: b.ancho,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 600,
                color: paleta.texto,
                borderRight: `1px solid ${paleta.borde}`,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {b.texto}
            </div>
          ))}
        </div>

        <div style={{ height: 24, position: 'relative' }}>
          {inferior.map((b, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: b.x,
                width: b.ancho,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: zoom === 'MES' ? 11 : 11,
                color: paleta.textoAtenuado,
                borderRight: `1px solid ${paleta.borde}`,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              {b.texto}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
