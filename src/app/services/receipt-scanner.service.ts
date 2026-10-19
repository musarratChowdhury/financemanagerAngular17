import { Injectable } from '@angular/core';

export interface OcrProgress {
  status: string;
  progress: number;
}

@Injectable({ providedIn: 'root' })
export class ReceiptScannerService {
  async recognize(
    image: Blob,
    onProgress?: (progress: OcrProgress) => void
  ): Promise<string> {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng', undefined, {
      workerPath: '/ocr/worker.min.js',
      corePath: '/ocr/core',
      langPath: '/ocr',
      dataPath: '/ocr',
      cachePath: 'finance-manager-ocr',
      cacheMethod: 'write',
      gzip: true,
      logger: (message) =>
        onProgress?.({
          status: message.status,
          progress: Math.max(0, Math.min(1, message.progress ?? 0)),
        }),
    });

    try {
      const result = await worker.recognize(image);
      return result.data.text;
    } finally {
      await worker.terminate();
    }
  }
}
