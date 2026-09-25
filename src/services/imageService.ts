import { AppError } from './errors';

/** Limite de envio: 10 MB (o bucket eco-evidence também recusa acima disso). */
export const MAX_INPUT_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Validação antes de qualquer processamento (mensagem amigável, sem upload). */
export function validateEvidenceFile(file: File): void {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) throw new AppError('image_invalid');
  if (file.size > MAX_INPUT_BYTES) throw new AppError('image_too_large');
}
const IMAGE_MAX_SIDE = 1600;
const THUMB_MAX_SIDE = 400;

export interface PreparedImage {
  image: Blob;
  thumbnail: Blob;
}

/**
 * Prepara a foto antes do envio: redimensiona, gera a miniatura e
 * re-codifica em JPEG. Isso reduz o tamanho (fica bem abaixo do limite de
 * 10 MB do bucket) e remove metadados EXIF, como a localização GPS da foto.
 */
export async function prepareEvidenceImage(file: File): Promise<PreparedImage> {
  validateEvidenceFile(file);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (err) {
    throw new AppError('image_invalid', err);
  }

  try {
    const [image, thumbnail] = await Promise.all([
      resize(bitmap, IMAGE_MAX_SIDE, 0.82),
      resize(bitmap, THUMB_MAX_SIDE, 0.75),
    ]);
    return { image, thumbnail };
  } finally {
    bitmap.close();
  }
}

function resize(bitmap: ImageBitmap, maxSide: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new AppError('image_invalid'));
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new AppError('image_invalid'))),
      'image/jpeg',
      quality,
    );
  });
}
