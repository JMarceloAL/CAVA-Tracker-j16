import React, {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
} from 'react';

import {
    View,
} from 'react-native';

import {
    Map,
    Marker,
    Camera,
    GeoJSONSource,
    Layer,
    type CameraRef,
} from '@maplibre/maplibre-react-native';

import type {
    TrackerLocation,
} from '../../types/Tracker';

import {
    useTheme,
} from '../../contexts/ThemeContext';

import { APP_GREEN } from '../../theme/colors';

import {
    styles,
} from './styles';

type Props = {
    location: TrackerLocation | null;

    routePoints?: TrackerLocation[];

    /**
     * true:
     * a câmera acompanha o rastreador.
     *
     * false:
     * o mapa fica livre e somente o marcador se movimenta.
     */
    followEnabled?: boolean;

    /**
     * true (padrão): `routePoints` é uma rota fechada (histórico) —
     * a câmera enquadra a rota inteira e não segue o marcador.
     *
     * false: é o trajeto do Tempo Real — a linha é desenhada, mas a
     * câmera continua seguindo o rastreador normalmente.
     */
    fitRoute?: boolean;

    /**
     * Chamado quando o usuário movimenta o mapa manualmente.
     */
    onUserPanned?: () => void;
};

export type TrackerMapHandle = {
    /**
     * Recentraliza a câmera no rastreador.
     */
    centerOnTracker: () => void;
};

const MAPTILER_KEY =
    process.env.EXPO_PUBLIC_MAPTILER_KEY;

const MAP_STYLE_LIGHT =
    `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`;

const MAP_STYLE_DARK =
    `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${MAPTILER_KEY}`;

type LngLat = [number, number];

type LngLatBounds = [
    number,
    number,
    number,
    number
];

const TrackerMap = forwardRef<TrackerMapHandle, Props>(
    function TrackerMap(
        {
            location,
            routePoints = [],
            followEnabled = true,
            fitRoute = true,
            onUserPanned,
        },
        ref
    ) {
        const {
            isDark,
        } = useTheme();

        const mapStyle =
            isDark
                ? MAP_STYLE_DARK
                : MAP_STYLE_LIGHT;

        const cameraRef =
            useRef<CameraRef>(null);

        /**
         * Controle da câmera.
         */
        const hasInitialCamera =
            useRef(false);

        const lastFittedRouteKey =
            useRef<string | null>(null);

        const userInteractionRef =
            useRef(false);

        /**
         * Coordenadas atuais do tracker.
         *
         * MapLibre trabalha com:
         * [longitude, latitude]
         */
        const lngLat =
            useMemo<LngLat>(() => {
                if (!location) {
                    return [0, 0];
                }

                const longitude =
                    Number(
                        location.longitude
                    );

                const latitude =
                    Number(
                        location.latitude
                    );

                if (
                    !Number.isFinite(
                        longitude
                    ) ||
                    !Number.isFinite(
                        latitude
                    )
                ) {
                    return [0, 0];
                }

                return [
                    longitude,
                    latitude,
                ];
            }, [
                location,
            ]);

        /**
         * Validação dos pontos da rota.
         */
        const validRoutePoints =
            useMemo<TrackerLocation[]>(() => {
                if (
                    !Array.isArray(
                        routePoints
                    )
                ) {
                    return [];
                }

                return routePoints.filter(
                    point => {
                        if (!point) {
                            return false;
                        }

                        const latitude =
                            Number(
                                point.latitude
                            );

                        const longitude =
                            Number(
                                point.longitude
                            );

                        return (
                            Number.isFinite(
                                latitude
                            ) &&
                            Number.isFinite(
                                longitude
                            ) &&
                            latitude >= -90 &&
                            latitude <= 90 &&
                            longitude >= -180 &&
                            longitude <= 180
                        );
                    }
                );
            }, [
                routePoints,
            ]);

        /**
         * Existe uma rota a ser enquadrada (histórico)? Nesse caso a
         * câmera fica na rota, em vez de seguir o marcador.
         */
        const hasFittedRoute =
            fitRoute &&
            validRoutePoints.length >= 2;

        /**
         * GeoJSON da rota.
         */
        const routeGeoJson =
            useMemo(() => {
                const coordinates =
                    validRoutePoints.map(
                        point =>
                            [
                                Number(
                                    point.longitude
                                ),
                                Number(
                                    point.latitude
                                ),
                            ] as LngLat
                    );

                return {
                    type:
                        'Feature' as const,

                    properties: {},

                    geometry: {
                        type:
                            'LineString' as const,

                        coordinates,
                    },
                };
            }, [
                validRoutePoints,
            ]);

        /**
         * Bounding box da rota.
         *
         * IMPORTANTE:
         *
         * O MapLibre React Native espera
         * LngLatBounds no formato:
         *
         * [west, south, east, north]
         *
         * e NÃO:
         *
         * [
         *   [west, south],
         *   [east, north]
         * ]
         */
        const routeBounds =
            useMemo<LngLatBounds | null>(() => {
                if (
                    validRoutePoints.length < 2
                ) {
                    return null;
                }

                let minLatitude =
                    Number.POSITIVE_INFINITY;

                let maxLatitude =
                    Number.NEGATIVE_INFINITY;

                let minLongitude =
                    Number.POSITIVE_INFINITY;

                let maxLongitude =
                    Number.NEGATIVE_INFINITY;

                for (
                    const point
                    of validRoutePoints
                ) {
                    const latitude =
                        Number(
                            point.latitude
                        );

                    const longitude =
                        Number(
                            point.longitude
                        );

                    if (
                        latitude <
                        minLatitude
                    ) {
                        minLatitude =
                            latitude;
                    }

                    if (
                        latitude >
                        maxLatitude
                    ) {
                        maxLatitude =
                            latitude;
                    }

                    if (
                        longitude <
                        minLongitude
                    ) {
                        minLongitude =
                            longitude;
                    }

                    if (
                        longitude >
                        maxLongitude
                    ) {
                        maxLongitude =
                            longitude;
                    }
                }

                return [
                    minLongitude,
                    minLatitude,
                    maxLongitude,
                    maxLatitude,
                ];
            }, [
                validRoutePoints,
            ]);

        /**
         * Chave da rota.
         *
         * Usada para evitar executar
         * fitBounds várias vezes para
         * a mesma rota.
         */
        const routeKey =
            useMemo(() => {
                if (
                    validRoutePoints.length === 0
                ) {
                    return null;
                }

                const first =
                    validRoutePoints[0];

                const last =
                    validRoutePoints[
                    validRoutePoints.length - 1
                    ];

                return [
                    validRoutePoints.length,
                    first.latitude,
                    first.longitude,
                    last.latitude,
                    last.longitude,
                ].join('|');
            }, [
                validRoutePoints,
            ]);

        /**
         * Padding usado pelo fitBounds.
         *
         * A versão atual do MapLibre espera
         * ViewPadding:
         *
         * {
         *   top,
         *   right,
         *   bottom,
         *   left
         * }
         */
        const routePadding =
            useMemo(() => {
                return {
                    top: 60,
                    right: 60,
                    bottom: 60,
                    left: 60,
                };
            }, []);

        /**
         * Recentralizar mapa.
         *
         * Se houver rota histórica:
         * enquadra a rota inteira.
         *
         * Caso contrário:
         * centraliza no tracker.
         */
        useImperativeHandle(
            ref,
            () => ({
                centerOnTracker: () => {
                    userInteractionRef.current = false;

                    /**
                     * Rota histórica.
                     */
                    if (
                        routeBounds &&
                        hasFittedRoute
                    ) {
                        cameraRef.current?.fitBounds(
                            routeBounds,
                            {
                                padding:
                                    routePadding,
                                duration:
                                    700,
                            }
                        );

                        return;
                    }

                    /**
                     * Localização normal.
                     */
                    if (!location) {
                        return;
                    }

                    cameraRef.current?.easeTo({
                        center:
                            lngLat,
                        duration:
                            600,
                    });
                },
            }),
            [
                routeBounds,
                routePadding,
                hasFittedRoute,
                location,
                lngLat,
            ]
        );

        /**
         * Enquadrar rota histórica
         * automaticamente quando uma
         * nova rota chegar.
         */
        useEffect(() => {
            if (
                !routeBounds ||
                !hasFittedRoute
            ) {
                return;
            }

            if (
                !cameraRef.current
            ) {
                return;
            }

            if (
                routeKey &&
                lastFittedRouteKey.current ===
                routeKey
            ) {
                return;
            }

            lastFittedRouteKey.current =
                routeKey;

            console.log(
                '[TrackerMap] enquadrando rota:',
                validRoutePoints.length,
                'pontos'
            );

            const timer =
                setTimeout(() => {
                    cameraRef.current?.fitBounds(
                        routeBounds,
                        {
                            padding:
                                routePadding,
                            duration:
                                800,
                        }
                    );
                }, 150);

            return () => {
                clearTimeout(
                    timer
                );
            };
        }, [
            routeBounds,
            routePadding,
            hasFittedRoute,
            validRoutePoints.length,
            routeKey,
        ]);

        /**
         * Primeira centralização.
         *
         * Se não houver rota histórica,
         * centraliza inicialmente no tracker.
         */
        useEffect(() => {
            if (!location) {
                return;
            }

            /**
             * Se existe uma rota,
             * o fitBounds cuida da câmera.
             */
            if (
                hasFittedRoute
            ) {
                return;
            }

            if (
                hasInitialCamera.current
            ) {
                return;
            }

            hasInitialCamera.current =
                true;

            const timer =
                setTimeout(() => {
                    cameraRef.current?.easeTo({
                        center:
                            lngLat,
                        duration:
                            500,
                    });
                }, 100);

            return () => {
                clearTimeout(
                    timer
                );
            };
        }, [
            location,
            lngLat,
            hasFittedRoute,
        ]);

        /**
         * Quando o modo seguir é (re)ativado — pelo botão de
         * recentralizar ou pela tela (troca de rastreador, Tempo
         * Real) — esquece o arraste manual anterior. Sem isso a
         * câmera ficava parada mesmo com o modo seguir ligado.
         */
        useEffect(() => {
            if (followEnabled) {
                userInteractionRef.current = false;
            }
        }, [
            followEnabled,
        ]);

        /**
         * Modo seguir.
         *
         * Quando o tracker recebe uma nova
         * posição e followEnabled está ativo,
         * a câmera acompanha.
         */
        useEffect(() => {
            if (!location) {
                return;
            }

            /**
             * Rota histórica:
             * não mover a câmera.
             */
            if (
                hasFittedRoute
            ) {
                return;
            }

            /**
             * Mapa livre.
             */
            if (!followEnabled) {
                return;
            }

            if (userInteractionRef.current) {
                return;
            }

            cameraRef.current?.easeTo({
                center:
                    lngLat,
                duration:
                    900,
            });
        }, [
            location,
            lngLat,
            followEnabled,
            hasFittedRoute,
        ]);

        /**
         * Movimento manual do usuário.
         */
        function handleRegionDidChange(
            event: any
        ) {
            const isUserInteraction =
                event?.properties?.isUserInteraction === true ||
                event?.properties?.isGesture === true;

            if (isUserInteraction) {
                userInteractionRef.current = true;
                onUserPanned?.();
            }
        }

        /**
         * Sem localização.
         */
        if (!location) {
            return (
                <View
                    style={
                        styles.container
                    }
                />
            );
        }

        /**
         * Mapa.
         */
        return (
            <Map
                style={
                    styles.map
                }
                mapStyle={
                    mapStyle
                }
                androidView="texture"
                compass={false}
                onRegionDidChange={
                    handleRegionDidChange
                }
            >
                {/**
                 * Câmera
                 */}
                <Camera
                    ref={
                        cameraRef
                    }
                    initialViewState={{
                        center:
                            lngLat,
                        zoom:
                            15,
                    }}
                />

                {/**
                 * Rota
                 */}
                {
                    routeGeoJson
                        .geometry
                        .coordinates
                        .length >= 2 && (
                        <GeoJSONSource
                            id="tracker-route-source"
                            data={
                                routeGeoJson
                            }
                        >
                            <Layer
                                id="tracker-route-line"
                                type="line"
                                layout={{
                                    'line-cap':
                                        'round',

                                    'line-join':
                                        'round',
                                }}
                                paint={{
                                    'line-color':
                                        isDark
                                            ? APP_GREEN
                                            : '#1E90FF',

                                    'line-width':
                                        5,

                                    'line-opacity':
                                        0.95,
                                }}
                            />
                        </GeoJSONSource>
                    )
                }

                {/**
                 * Marcador
                 */}
                <Marker
                    id="tracker-marker"
                    lngLat={
                        lngLat
                    }
                >
                    <View
                        style={
                            styles.marker
                        }
                    />
                </Marker>
            </Map>
        );
    }
);

TrackerMap.displayName =
    'TrackerMap';

export default TrackerMap;