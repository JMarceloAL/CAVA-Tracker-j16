// src/utils/mapStyle.ts

const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY;

/** Estilo do mapa (MapTiler), claro ou escuro. */
export function getMapStyleUrl(isDark: boolean): string {
    const style = isDark ? 'streets-v2-dark' : 'streets-v2';

    return `https://api.maptiler.com/maps/${style}/style.json?key=${MAPTILER_KEY}`;
}
