/**
 * directions.ts — Google Directions API
 *
 * Called directly from the app (the FastAPI proxy is retired). The Maps key
 * lives in app config; before production move this behind an Edge Function.
 * Falls back to null on any failure — callers handle it gracefully.
 */

import { Config } from '../config';

export interface DirectionsStep {
    instruction: string;
    distance: string;
    duration: string;
    end: { latitude: number; longitude: number };
}

export interface DirectionsResult {
    polyline: { latitude: number; longitude: number }[];
    steps: DirectionsStep[];
    totalDistance: string;
    totalDuration: string;
}

/** Google Encoded Polyline Algorithm decoder */
function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
    const points: { latitude: number; longitude: number }[] = [];
    let index = 0,
        lat = 0,
        lng = 0;
    while (index < encoded.length) {
        let b: number,
            shift = 0,
            result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        lat += result & 1 ? ~(result >> 1) : result >> 1;
        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        lng += result & 1 ? ~(result >> 1) : result >> 1;
        points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return points;
}

function parseDirectionsResponse(data: any): DirectionsResult | null {
    if (!data.routes?.length) return null;
    const route = data.routes[0];
    const leg = route.legs[0];
    const polyline = decodePolyline(route.overview_polyline.points);

    const steps: DirectionsStep[] = leg.steps.map((s: any) => ({
        instruction: s.html_instructions.replace(/<[^>]+>/g, ''),
        distance: s.distance.text,
        duration: s.duration.text,
        end: { latitude: s.end_location.lat, longitude: s.end_location.lng },
    }));

    return {
        polyline,
        steps,
        totalDistance: leg.distance.text,
        totalDuration: leg.duration.text,
    };
}

export async function fetchDirections(
    origin: { lat: number; lon: number },
    destination: { latitude: number; longitude: number },
    apiKeyOverride?: string,
): Promise<DirectionsResult | null> {
    // Call Google Directions directly (backend proxy retired with the FastAPI layer).
    // Key travels with the app config — acceptable for the demo; move to an
    // Edge Function proxy before production.
    const apiKey = apiKeyOverride || Config.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return null;

    try {
        const url =
            'https://maps.googleapis.com/maps/api/directions/json' +
            `?origin=${origin.lat},${origin.lon}` +
            `&destination=${destination.latitude},${destination.longitude}` +
            `&key=${apiKey}&language=ru&mode=driving`;

        const res = await fetch(url);
        if (!res.ok) return null;
        const data: any = await res.json();
        if (data?.status !== 'OK') return null;
        return parseDirectionsResponse(data);
    } catch {
        return null;
    }
}
