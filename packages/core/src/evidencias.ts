export class ErrorArchivoEvidencia extends Error {
  readonly codigo: 'TIPO_ARCHIVO_NO_PERMITIDO' | 'CONTENIDO_DEMASIADO_GRANDE';
  constructor(codigo: 'TIPO_ARCHIVO_NO_PERMITIDO' | 'CONTENIDO_DEMASIADO_GRANDE', mensaje: string) {
    super(mensaje);
    this.name = 'ErrorArchivoEvidencia';
    this.codigo = codigo;
  }
}

export const TAMANO_MAXIMO_EVIDENCIA = 10 * 1024 * 1024;

interface ReglaArchivo {
  extensiones: readonly string[];
  mimes: readonly string[];
  verificarBytes: (bytes: Uint8Array) => boolean;
}

const esZip = (b: Uint8Array): boolean =>
  b.length >= 4 &&
  b[0] === 0x50 &&
  b[1] === 0x4b &&
  (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07) &&
  (b[3] === 0x04 || b[3] === 0x06 || b[3] === 0x08);

const esOle = (b: Uint8Array): boolean =>
  b.length >= 4 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0;

const REGLAS_ARCHIVOS: readonly ReglaArchivo[] = [
  {
    extensiones: ['.pdf'],
    mimes: ['application/pdf'],
    verificarBytes: (b) =>
      b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  },
  {
    extensiones: ['.png'],
    mimes: ['image/png'],
    verificarBytes: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    extensiones: ['.jpg', '.jpeg'],
    mimes: ['image/jpeg'],
    verificarBytes: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    extensiones: ['.webp'],
    mimes: ['image/webp'],
    verificarBytes: (b) =>
      b.length >= 12 &&
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x41 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
  {
    extensiones: ['.docx'],
    mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    verificarBytes: esZip,
  },
  {
    extensiones: ['.xlsx'],
    mimes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    verificarBytes: esZip,
  },
  {
    extensiones: ['.doc'],
    mimes: ['application/msword'],
    verificarBytes: esOle,
  },
  {
    extensiones: ['.xls'],
    mimes: ['application/vnd.ms-excel'],
    verificarBytes: esOle,
  },
];

export function sanearNombreArchivo(nombre: string): string {
  const sinRutas = nombre.replace(/^.*[/\\]/, '').replace(/\.\./g, '');
  const saneado = sinRutas.replace(/[^a-zA-Z0-9._\-áéíóúÁÉÍÓÚñÑ() ]/g, '_').trim();
  const resultado = saneado || 'archivo';
  return resultado.length > 255 ? resultado.slice(-255) : resultado;
}

export function extraerExtension(nombre: string): string {
  const partes = nombre.toLowerCase().split('.');
  return partes.length > 1 ? `.${partes[partes.length - 1]}` : '';
}

export function validarArchivoEvidencia(
  nombre: string,
  tipoMime: string,
  primerosBytes: Uint8Array,
): { extension: string; tipoMime: string } {
  const extension = extraerExtension(nombre);
  if (!extension) {
    throw new ErrorArchivoEvidencia(
      'TIPO_ARCHIVO_NO_PERMITIDO',
      'El archivo debe tener una extensión válida.',
    );
  }

  const mimeLimpio = tipoMime.toLowerCase().trim();
  const regla = REGLAS_ARCHIVOS.find(
    (r) => r.extensiones.includes(extension) && r.mimes.includes(mimeLimpio),
  );

  if (!regla || !regla.verificarBytes(primerosBytes)) {
    throw new ErrorArchivoEvidencia(
      'TIPO_ARCHIVO_NO_PERMITIDO',
      'El tipo de archivo o su contenido real no está permitido.',
    );
  }

  return { extension, tipoMime: mimeLimpio };
}
