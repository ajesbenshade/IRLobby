/**
 * Profile photos are stored as avatar_url / photo_album on PATCH /api/users/profile/.
 * The API accepts https URLs or jpeg/png/webp data URLs up to 1.2M characters. No S3.
 * Blob URLs from URL.createObjectURL never leave the browser and must not be sent.
 */

export const MAX_AVATAR_DATA_URL_CHARS = 1_200_000;
export const MAX_AVATAR_EDGE = 900;

const PERSISTED_IMAGE = /^data:image\/(?:jpeg|jpg|png|webp);base64,/i;

export const isPersistedImageRef = (value: string | null | undefined) => {
  const candidate = value?.trim() ?? '';
  if (!candidate || candidate.startsWith('blob:') || candidate.length > MAX_AVATAR_DATA_URL_CHARS) {
    return false;
  }
  if (candidate.startsWith('https://')) {
    return true;
  }
  return PERSISTED_IMAGE.test(candidate);
};

/** Fields the profile PATCH actually stores. `profileImageUrl` is not one of them. */
export const profileImagePatch = (input: {
  avatarUrl?: string | null;
  photoAlbum?: readonly string[] | null;
}): { avatar_url?: string; photo_album?: string[] } => {
  const body: { avatar_url?: string; photo_album?: string[] } = {};
  const avatar = input.avatarUrl?.trim() ?? '';
  if (isPersistedImageRef(avatar)) {
    body.avatar_url = avatar;
  }
  if (input.photoAlbum) {
    body.photo_album = input.photoAlbum.filter((item) => isPersistedImageRef(item));
  }
  return body;
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Failed to read selected file.'));
    };
    reader.onerror = () => reject(new Error('Failed to read selected file.'));
    reader.readAsDataURL(file);
  });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('That photo could not be opened.'));
    image.src = src;
  });

/**
 * FileReader, then a jpeg data URL resized so the longest edge is at most 900px
 * and the string stays within the API limit.
 */
export const fileToImageDataUrl = async (file: File): Promise<string> => {
  const type = file.type.toLowerCase();
  if (!type.startsWith('image/') || type === 'image/svg+xml') {
    throw new Error('That file type is not allowed.');
  }
  const original = await readFileAsDataUrl(file);
  const image = await loadImage(original);
  const longest = Math.max(image.width, image.height) || 1;
  const scale = Math.min(1, MAX_AVATAR_EDGE / longest);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not prepare that photo.');
  }
  context.drawImage(image, 0, 0, width, height);
  let quality = 0.72;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > MAX_AVATAR_DATA_URL_CHARS && quality > 0.45) {
    quality = Math.round((quality - 0.08) * 100) / 100;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  if (!isPersistedImageRef(dataUrl)) {
    throw new Error('Image is too large. Try a smaller photo.');
  }
  return dataUrl;
};
