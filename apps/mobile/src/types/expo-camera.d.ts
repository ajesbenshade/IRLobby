declare module 'expo-camera' {
  import type { ComponentType } from 'react';

  export type CameraPermissionResponse = {
    granted?: boolean;
  };

  export const CameraView: ComponentType<{
    style?: object;
    facing?: 'front' | 'back';
    enableTorch?: boolean;
    barcodeScannerSettings?: { barcodeTypes: string[] };
    onBarcodeScanned?: (event: { data?: string }) => void;
  }>;

  export function useCameraPermissions(): [
    CameraPermissionResponse | null,
    () => Promise<CameraPermissionResponse>,
  ];
}
