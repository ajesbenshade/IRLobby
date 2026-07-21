import * as ImageManipulator from "expo-image-manipulator";
import type { ImagePickerAsset } from "expo-image-picker";

const MAX_UPLOAD_IMAGE_EDGE = 900;
const UPLOAD_IMAGE_QUALITY = 0.72;

const buildResizeAction = (
  asset: ImagePickerAsset
): ImageManipulator.Action | null => {
  const width = typeof asset.width === "number" ? asset.width : 0;
  const height = typeof asset.height === "number" ? asset.height : 0;

  if (
    width <= 0 ||
    height <= 0 ||
    Math.max(width, height) <= MAX_UPLOAD_IMAGE_EDGE
  ) {
    return null;
  }

  if (width >= height) {
    return { resize: { width: MAX_UPLOAD_IMAGE_EDGE } };
  }

  return { resize: { height: MAX_UPLOAD_IMAGE_EDGE } };
};

export const imageAssetToUploadDataUrl = async (
  asset: ImagePickerAsset
): Promise<string> => {
  const resizeAction = buildResizeAction(asset);
  const result = await ImageManipulator.manipulateAsync(
    asset.uri,
    resizeAction ? [resizeAction] : [],
    {
      base64: true,
      compress: UPLOAD_IMAGE_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );

  if (!result.base64) {
    throw new Error("Selected image could not be prepared for upload.");
  }

  return `data:image/jpeg;base64,${result.base64}`;
};
