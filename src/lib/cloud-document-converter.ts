import { convertWorksheetToPdf, HseqPdfGenerationPayload } from './drone-inspection';
import ExcelJS from 'exceljs';

export interface OfficePdfConversionResult {
  fileName: string;
  pdfBase64: string;
  pdfBuffer: Buffer;
  conversionMethod: 'convertapi' | 'cloudconvert' | 'calibrated_canvas';
}

/**
 * Convierte un libro/buffer de Excel (.xlsx) diligenciado a PDF nativo.
 * Solución B: Utiliza motores de renderizado documental de oficina en la nube (ConvertAPI / CloudConvert).
 * En caso de no tener API key configurada o presentarse una contingencia, recurre de forma transparente a la Solución A1 (calibrada).
 */
export async function convertOfficeDocumentToPdf(
  excelBuffer: Buffer,
  worksheet: ExcelJS.Worksheet,
  payload: HseqPdfGenerationPayload
): Promise<OfficePdfConversionResult> {
  const cleanFormat = (payload.formatCode || 'HSEQ').replace(/[^a-zA-Z0-9\-_]/g, '_');
  const cleanProject = (payload.projectName || 'Proyecto').replace(/[^a-zA-Z0-9\-_]/g, '_').substring(0, 25);
  const cleanDate = (payload.inspectionDate || new Date().toISOString().split('T')[0]).replace(/[^0-9\-]/g, '');
  const fileName = `Inspeccion_${cleanFormat}_${cleanProject}_${cleanDate}.pdf`;

  // ── Opción B.1: ConvertAPI (Renderizado nativo Microsoft Office / LibreOffice) ──
  const convertApiSecret = process.env.CONVERTAPI_SECRET;
  if (convertApiSecret) {
    try {
      const response = await fetch('https://v2.convertapi.com/convert/xlsx/to/pdf', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${convertApiSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Parameters: [
            {
              Name: 'File',
              FileValue: {
                Name: `${cleanFormat}.xlsx`,
                Data: excelBuffer.toString('base64'),
              },
            },
            {
              Name: 'StoreFile',
              Value: false,
            },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const base64Data = data?.Files?.[0]?.FileData;
        if (base64Data) {
          const pdfBuffer = Buffer.from(base64Data, 'base64');
          return {
            fileName,
            pdfBase64: base64Data,
            pdfBuffer,
            conversionMethod: 'convertapi',
          };
        }
      } else {
        const errorText = await response.text();
        console.warn('ConvertAPI returned non-200 status:', response.status, errorText);
      }
    } catch (err) {
      console.warn('Error during ConvertAPI document conversion:', err);
    }
  }

  // ── Opción B.2: CloudConvert API ──
  const cloudConvertApiKey = process.env.CLOUDCONVERT_API_KEY;
  if (cloudConvertApiKey) {
    try {
      // Crear job de import/base64 -> convert/pdf -> export/url
      const jobRes = await fetch('https://api.cloudconvert.com/v2/jobs', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cloudConvertApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tasks: {
            'import-xlsx': {
              operation: 'import/base64',
              file: excelBuffer.toString('base64'),
              filename: `${cleanFormat}.xlsx`,
            },
            'convert-pdf': {
              operation: 'convert',
              input: 'import-xlsx',
              output_format: 'pdf',
              engine: 'office',
            },
            'export-url': {
              operation: 'export/url',
              input: 'convert-pdf',
            },
          },
        }),
      });

      if (jobRes.ok) {
        interface CloudConvertTask {
          name?: string;
          status?: string;
          result?: {
            files?: Array<{ url?: string }>;
          };
        }
        const jobData = (await jobRes.json()) as { data?: { tasks?: CloudConvertTask[] } };
        const tasks = jobData?.data?.tasks || [];
        const exportTask = tasks.find(
          (t) => t.name === 'export-url' && t.status === 'finished'
        );
        const fileUrl = exportTask?.result?.files?.[0]?.url;

        if (fileUrl) {
          const pdfRes = await fetch(fileUrl);
          const arrayBuffer = await pdfRes.arrayBuffer();
          const pdfBuffer = Buffer.from(arrayBuffer);
          return {
            fileName,
            pdfBase64: pdfBuffer.toString('base64'),
            pdfBuffer,
            conversionMethod: 'cloudconvert',
          };
        }
      }
    } catch (err) {
      console.warn('Error during CloudConvert document conversion:', err);
    }
  }

  // ── Opción A1: Conversión Directa Calibrada en 1 Página (Fallback Robusto) ──
  const calibratedResult = convertWorksheetToPdf(worksheet, payload);
  return {
    ...calibratedResult,
    conversionMethod: 'calibrated_canvas',
  };
}
