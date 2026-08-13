/**
 * MapMarkers — рендеринг инцидентов и скота на карте.
 * Каждый маркер: карточка + стебель + точка в стиле Nothing Phone.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker, Circle } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius } from '../../constants/colors';
import { getIncidentMeta, Incident } from '../../constants/incidents';
import { LIVESTOCK_META, Livestock } from '../../constants/livestock';

interface IncidentMarkersProps {
    incidents: Incident[];
    onCalloutPress: (incident: Incident) => void;
}

export function IncidentMarkers({ incidents, onCalloutPress }: IncidentMarkersProps) {
    return (
        <>
            {incidents.map((inc) => {
                const meta = getIncidentMeta(inc.incident_type);
                return (
                    <React.Fragment key={`inc-${inc.id}`}>
                        <Marker
                            coordinate={{ latitude: inc.latitude, longitude: inc.longitude }}
                            onCalloutPress={() => onCalloutPress(inc)}
                            tracksViewChanges={false}
                            anchor={{ x: 0.5, y: 1 }}
                        >
                            <View style={styles.pinContainer}>
                                <View style={[styles.pinCard, { borderColor: meta.color }]}>
                                    <Ionicons
                                        name={meta.icon as any}
                                        size={16}
                                        color={meta.color}
                                    />
                                </View>
                                <View style={[styles.pinStem, { backgroundColor: meta.color }]} />
                                <View style={[styles.pinDot, { backgroundColor: meta.color }]} />
                            </View>
                        </Marker>
                        <Circle
                            center={{ latitude: inc.latitude, longitude: inc.longitude }}
                            radius={50}
                            fillColor={meta.color + 'AA'}
                            strokeWidth={0}
                        />
                        <Circle
                            center={{ latitude: inc.latitude, longitude: inc.longitude }}
                            radius={200}
                            fillColor={meta.color + '40'}
                            strokeWidth={0}
                        />
                        <Circle
                            center={{ latitude: inc.latitude, longitude: inc.longitude }}
                            radius={600}
                            fillColor={meta.color + '18'}
                            strokeWidth={0}
                        />
                        <Circle
                            center={{ latitude: inc.latitude, longitude: inc.longitude }}
                            radius={1200}
                            fillColor={meta.color + '08'}
                            strokeColor={meta.color + '30'}
                            strokeWidth={1}
                        />
                    </React.Fragment>
                );
            })}
        </>
    );
}

interface LivestockMarkersProps {
    livestock: Livestock[];
}

export function LivestockMarkers({ livestock }: LivestockMarkersProps) {
    return (
        <>
            {livestock.map((animal) => {
                const meta = LIVESTOCK_META[animal.type] ?? {
                    label: 'Жануар',
                    color: Colors.brand.primary,
                    emoji: '🐾',
                };
                const isDangerous = animal.isNearRoad && animal.distanceToRoadM < 300;
                const markerColor = isDangerous ? Colors.alert.critical : meta.color;
                return (
                    <React.Fragment key={`ls-${animal.id}`}>
                        <Marker
                            coordinate={{ latitude: animal.latitude, longitude: animal.longitude }}
                            tracksViewChanges={false}
                            anchor={{ x: 0.5, y: 1 }}
                        >
                            <View style={styles.pinContainer}>
                                <View
                                    style={[
                                        styles.pinCard,
                                        styles.pinCardLivestock,
                                        { borderColor: markerColor },
                                    ]}
                                >
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
                        <Circle
                            center={{ latitude: animal.latitude, longitude: animal.longitude }}
                            radius={40}
                            fillColor={markerColor + 'BB'}
                            strokeWidth={0}
                        />
                        {isDangerous && (
                            <Circle
                                center={{ latitude: animal.latitude, longitude: animal.longitude }}
                                radius={animal.distanceToRoadM}
                                fillColor={Colors.alert.critical + '20'}
                                strokeColor={Colors.alert.critical + '50'}
                                strokeWidth={1}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </>
    );
}

const styles = StyleSheet.create({
    pinContainer: { alignItems: 'center' },
    pinCard: {
        width: 38,
        height: 38,
        backgroundColor: Colors.bg.secondary,
        borderRadius: Radius.sm,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
        elevation: 6,
    },
    pinCardLivestock: { width: 42, height: 42, borderRadius: Radius.md, position: 'relative' },
    pinStem: { width: 2, height: 7 },
    pinDot: { width: 6, height: 6, borderRadius: 3 },
    livestockEmoji: { fontSize: 20 },
    dangerBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: Colors.alert.critical,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: Colors.bg.secondary,
    },
    dangerBadgeText: { fontSize: 9, fontWeight: '900', color: Colors.white },
});
