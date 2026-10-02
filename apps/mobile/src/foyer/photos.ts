import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';

export const GATHERING_PHOTO_MAX_EDGE = 1600;
export const GATHERING_PHOTO_JPEG_QUALITY = 0.7;
export const MAX_GATHERING_PHOTOS = 50;

export async function compressGatheringPhoto(uri: string): Promise<string> {
  const result = await manipulateAsync(
    uri,
    [{ resize: { width: GATHERING_PHOTO_MAX_EDGE } }],
    { compress: GATHERING_PHOTO_JPEG_QUALITY, format: SaveFormat.JPEG },
  );
  return result.uri;
}
