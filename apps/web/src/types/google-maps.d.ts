declare global {
  interface Window {
    google: typeof google;
  }
}

declare namespace google {
  namespace maps {
    class Map {
      constructor(mapDiv: Element | null, opts?: MapOptions);
      setCenter(latlng: LatLngLiteral): void;
      setZoom(zoom: number): void;
    }

    class Marker {
      constructor(opts?: MarkerOptions);
      setMap(map: Map | null): void;
      addListener(eventName: string, handler: () => void): void;
    }

    class InfoWindow {
      constructor(opts?: InfoWindowOptions);
      open(map?: Map, anchor?: Marker): void;
    }

    class Size {
      constructor(width: number, height: number);
    }

    interface MapOptions {
      center?: LatLngLiteral;
      zoom?: number;
      styles?: MapTypeStyle[];
    }

    interface MarkerOptions {
      position?: LatLngLiteral;
      map?: Map | null;
      title?: string;
      icon?: string | Icon;
    }

    interface InfoWindowOptions {
      content?: string | Element;
    }

    interface LatLngLiteral {
      lat: number;
      lng: number;
    }

    interface Icon {
      url: string;
      scaledSize?: Size;
    }

    interface MapTypeStyle {
      featureType?: string;
      elementType?: string;
      stylers?: Array<{ [key: string]: unknown }>;
    }
  }
}

export {};
