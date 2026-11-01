import { describe, expect, it } from 'vitest';
import {
  ErrorArchivoEvidencia,
  extraerExtension,
  sanearNombreArchivo,
  validarArchivoEvidencia,
} from './evidencias';

describe('evidencias en core', () => {
  it('sanearNombreArchivo previene path traversal y caracteres invalidos', () => {
    expect(sanearNombreArchivo('../../etc/passwd.pdf')).toBe('passwd.pdf');
    expect(sanearNombreArchivo('..\\..\\windows\\system32.dll')).toBe('system32.dll');
    expect(sanearNombreArchivo('informe final (versión 2).pdf')).toBe(
      'informe final (versión 2).pdf',
    );
    expect(sanearNombreArchivo('')).toBe('archivo');
  });

  it('extraerExtension obtiene la extension en minusculas', () => {
    expect(extraerExtension('DOCUMENTO.PDF')).toBe('.pdf');
    expect(extraerExtension('archivo.tar.gz')).toBe('.gz');
    expect(extraerExtension('sin-extension')).toBe('');
  });

  it('valida pdf con firma correcta', () => {
    const bytesPdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    const resultado = validarArchivoEvidencia('acta.pdf', 'application/pdf', bytesPdf);
    expect(resultado).toEqual({ extension: '.pdf', tipoMime: 'application/pdf' });
  });

  it('rechaza exe renombrado a pdf por discordancia con magic bytes', () => {
    const bytesExe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
    expect(() =>
      validarArchivoEvidencia('malicioso.pdf', 'application/pdf', bytesExe),
    ).toThrowError(ErrorArchivoEvidencia);
  });

  it('valida imagenes png y jpeg', () => {
    const bytesPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(validarArchivoEvidencia('captura.png', 'image/png', bytesPng)).toEqual({
      extension: '.png',
      tipoMime: 'image/png',
    });

    const bytesJpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    expect(validarArchivoEvidencia('foto.jpg', 'image/jpeg', bytesJpg)).toEqual({
      extension: '.jpg',
      tipoMime: 'image/jpeg',
    });
  });

  it('valida office docx y xlsx con firma zip', () => {
    const bytesZip = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    expect(
      validarArchivoEvidencia(
        'informe.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        bytesZip,
      ),
    ).toEqual({
      extension: '.docx',
      tipoMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  });

  it('rechaza tipos no permitidos o extension ausente', () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02]);
    expect(() => validarArchivoEvidencia('script.sh', 'application/x-sh', bytes)).toThrowError(
      ErrorArchivoEvidencia,
    );
    expect(() => validarArchivoEvidencia('sin-ext', 'application/pdf', bytes)).toThrowError(
      ErrorArchivoEvidencia,
    );
  });
});
