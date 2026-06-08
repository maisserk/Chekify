/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Chekify Enterprise Industrial SaaS Framework
 * Utility: imageCompressor
 * 
 * Provides ultra-fast canvas-based downscaling and compression on client browser,
 * optimized for field operators using mobile under unstable LTE/3G industrial coverage.
 */

/**
 * Resizes and compresses an image (File or base64 data-URL) to a custom size and quality.
 * Returns a Promise that resolves to a Blob.
 */
export function compressImage(
  source: File | string,
  maxWidth = 1024,
  maxHeight = 768,
  quality = 0.75
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Keep aspect ratio intact
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to acquire 2D canvas context.'));
        return;
      }

      // Draw and apply anti-aliasing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob of JPEG format with defined quality scale
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas image blob generation failed.'));
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = (err) => {
      reject(err);
    };

    if (source instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          img.src = e.target.result as string;
        } else {
          reject(new Error('Failed reading binary File descriptor.'));
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(source);
    } else {
      img.src = source;
    }
  });
}

/**
 * Utility to convert Blob back to Base64 (for offline-fallback storage queueing)
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
