// src/utils/geo.ts

/**
 * Calcula a distância em metros entre duas coordenadas (fórmula de Haversine).
 */
export function distanceInMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371000; // raio da Terra em metros
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}
/**
 * Polígono (GeoJSON) aproximando um círculo de `radiusMeters` em volta
 * do centro — usado pra desenhar as cercas virtuais no mapa.
 */
export function circlePolygon(
    latitude: number,
    longitude: number,
    radiusMeters: number,
    steps = 64
) {
    const earthRadius = 6371000;
    const latRad = (latitude * Math.PI) / 180;
    const coordinates: [number, number][] = [];

    for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * 2 * Math.PI;
        const dLat = (radiusMeters * Math.cos(angle)) / earthRadius;
        const dLon =
            (radiusMeters * Math.sin(angle)) /
            (earthRadius * Math.cos(latRad));

        coordinates.push([
            longitude + (dLon * 180) / Math.PI,
            latitude + (dLat * 180) / Math.PI,
        ]);
    }

    return {
        type: 'Feature' as const,
        properties: {},
        geometry: {
            type: 'Polygon' as const,
            coordinates: [coordinates],
        },
    };
}
