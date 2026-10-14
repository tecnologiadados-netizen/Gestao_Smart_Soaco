/**
 * Fundo dos mapas Leaflet.
 * O raster da CARTO (`basemaps.cartocdn.com`) sem `key` deixou de entregar o mapa
 * em 25/09/2026 e passou a devolver o tile "API KEY REQUIRED".
 */
export const MAPA_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

export const MAPA_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
