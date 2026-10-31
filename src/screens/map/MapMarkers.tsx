/**
 * MapMarkers — рендеринг инцидентов и скота на карте (MapLibre, не Google).
 * Каждый маркер: карточка + стебель + точка в стиле Nothing Phone.
 * Зоны вокруг меток — GeoJSON-полигоны + fill/line-слои: радиус в метрах
 * точный, без привязки к Google Maps SDK и её биллингу.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker, GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius } from '../../constants/colors';
import { getIncidentMeta, Incident } from '../../constants/incidents';
import { LIVESTOCK_META, Livestock, LivestockType } from '../../constants/livestock';

type RingFeature = {
    type: 'Feature';
    properties: { color: string; op: number };
    geometry: { type: 'Polygon'; coordinates: [number, number][][] };
};

/** Круговой полигон радиусом radiusM метров (48 сегментов) */
function circleRing(lat: number, lon: number, radiusM: number): [number, number][] {
    const dLat = radiusM / 111_320;
    const dLon = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
    const pts: [number, number][] = [];
    for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        pts.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]);
    }
    return pts;
}

function ringFeature(lat: number, lon: number, radiusM: number, color: string, op: number): RingFeature {
    return {
        type: 'Feature',
        properties: { color, op },
        geometry: { type: 'Polygon', coordinates: [circleRing(lat, lon, radiusM)] },
    };
}

interface IncidentMarkersProps {
    incidents: Incident[];
    onCalloutPress: (incident: Incident) => void;
}

export function IncidentMarkers({ incidents, onCalloutPress }: IncidentMarkersProps) {
    // fill-зоны: 50/200/600 м + 2 км (радиус срабатывания предупреждения,
    // Config.DEFAULT_PROXIMITY_RADIUS_KM) с внешним штрихом
    const fills = useMemo(
        () => ({
            type: 'FeatureCollection' as const,
            features: incidents.flatMap((inc) => {
                const meta = getIncidentMeta(inc.incident_type);
                return [
                    ringFeature(inc.latitude, inc.longitude, 50, meta.color, 0.67),
                    ringFeature(inc.latitude, inc.longitude, 200, meta.color, 0.25),
                    ringFeature(inc.latitude, inc.longitude, 600, meta.color, 0.09),
                    ringFeature(inc.latitude, inc.longitude, 2000, meta.color, 0.06),
                ];
            }),
        }),
        [incidents],
    );
    const strokes = useMemo(
        () => ({
            type: 'FeatureCollection' as const,
            features: incidents.map((inc) => {
                const meta = getIncidentMeta(inc.incident_type);
                return ringFeature(inc.latitude, inc.longitude, 2000, meta.color, 0.25);
            }),
        }),
        [incidents],
    );

    return (
        <>
            <GeoJSONSource id="incident-fills" data={fills}>
                <Layer
                    id="incident-fills-layer"
                    type="fill"
                    style={{ fillColor: ['get', 'color'], fillOpacity: ['get', 'op'] }}
                />
            </GeoJSONSource>
            <GeoJSONSource id="incident-strokes" data={strokes}>
                <Layer
                    id="incident-strokes-layer"
                    type="line"
                    style={{ lineColor: ['get', 'color'], lineOpacity: ['get', 'op'], lineWidth: 1 }}
                />
            </GeoJSONSource>
            {incidents.map((inc) => {
                const meta = getIncidentMeta(inc.incident_type);
                return (
                    <Marker
                        key={`inc-${inc.id}`}
                        id={`inc-${inc.id}`}
                        lngLat={[inc.longitude, inc.latitude]}
                        anchor="bottom"
                        onPress={() => onCalloutPress(inc)}
                    >
                        <View style={styles.pinContainer}>
                            <View style={[styles.pinCard, { borderColor: meta.color }]}>
                                <Ionicons name={meta.icon as any} size={16} color={meta.color} />
                            </View>
                            <View style={[styles.pinStem, { backgroundColor: meta.color }]} />
                            <View style={[styles.pinDot, { backgroundColor: meta.color }]} />
                        </View>
                    </Marker>
                );
            })}
        </>
    );
}

interface LivestockMarkersProps {
    livestock: Livestock[];
}

export function LivestockMarkers({ livestock }: LivestockMarkersProps) {
    const fills = useMemo(
        () => ({
            type: 'FeatureCollection' as const,
            features: livestock.flatMap((animal) => {
                const meta = LIVESTOCK_META[animal.type as LivestockType] ?? {
                    label: '—',
                    labelKk: '—',
                    icon: 'paw',
                    color: Colors.brand.primary,
                    emoji: '🐾',
                };
                const isDangerous = animal.isNearRoad && animal.distanceToRoadM < 300;
                const color = isDangerous ? Colors.alert.critical : meta.color;
                const feats = [ringFeature(animal.latitude, animal.longitude, 40, color, 0.73)];
                if (isDangerous) {
                    feats.push(
                        ringFeature(
                            animal.latitude,
                            animal.longitude,
                            animal.distanceToRoadM,
                            Colors.alert.critical,
                            0.13,
                        ),
                    );
                }
                return feats;
            }),
        }),
        [livestock],
    );
    const strokes = useMemo(
        () => ({
            type: 'FeatureCollection' as const,
            features: livestock
                .filter((a) => a.isNearRoad && a.distanceToRoadM < 300)
                .map((a) => ringFeature(a.latitude, a.longitude, a.distanceToRoadM, Colors.alert.critical, 0.31)),
        }),
        [livestock],
    );

    return (
        <>
            <GeoJSONSource id="livestock-fills" data={fills}>
                <Layer
                    id="livestock-fills-layer"
                    type="fill"
                    style={{ fillColor: ['get', 'color'], fillOpacity: ['get', 'op'] }}
                />
            </GeoJSONSource>
            <GeoJSONSource id="livestock-strokes" data={strokes}>
                <Layer
                    id="livestock-strokes-layer"
                    type="line"
                    style={{ lineColor: ['get', 'color'], lineOpacity: ['get', 'op'], lineWidth: 1 }}
                />
            </GeoJSONSource>
            {livestock.map((animal) => {
                const meta = LIVESTOCK_META[animal.type as LivestockType] ?? {
                    label: '—',
                    labelKk: '—',
                    icon: 'paw',
                    color: Colors.brand.primary,
                    emoji: '🐾',
                };
                const isDangerous = animal.isNearRoad && animal.distanceToRoadM < 300;
                const markerColor = isDangerous ? Colors.alert.critical : meta.color;
                return (
                    <Marker
                        key={`ls-${animal.id}`}
                        id={`ls-${animal.id}`}
                        lngLat={[animal.longitude, animal.latitude]}
                        anchor="bottom"
                    >
                        <View style={styles.pinContainer}>
                            <View style={[styles.pinCard, styles.pinCardLivestock, { borderColor: markerColor }]}>
                                <Text style={styles.livestockEmoji}>{meta.emoji}</Text>
                                {isDangerous && (
                                    <View style={styles.dangerBadge}>
                                        <Text style={styles.dangerBadgeText}>!</Text>
                                    </View>
                                )}
                            </View>
                            <View style={[styles.pinStem, { backgroundColor: markerColor }]} />
                            <View style={[styles.pinDot, { backgroundColor: markerColor }]} />
                        </View>
                    </Marker>
                );
            })}
        </>
    );
}

const styles = StyleSheet.create({
    pinContainer: { alignItems: 'center' },
    pinCard: {
        width: 38, height: 38,
        backgroundColor: Colors.bg.secondary,
        borderRadius: Radius.sm,
        borderWidth: 2,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4, shadowRadius: 5, elevation: 6,
    },
    pinCardLivestock: { width: 42, height: 42, borderRadius: Radius.md, position: 'relative' },
    pinStem: { width: 2, height: 7 },
    pinDot: { width: 6, height: 6, borderRadius: 3 },
    livestockEmoji: { fontSize: 20 },
    dangerBadge: {
        position: 'absolute', top: -4, right: -4,
        width: 16, height: 16, borderRadius: 8,
        backgroundColor: Colors.alert.critical,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1.5, borderColor: Colors.bg.secondary,
    },
    dangerBadgeText: { fontSize: 9, fontWeight: '900', color: Colors.white },
});
