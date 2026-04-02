/**
 * directions.ts — Directions via backend proxy
 *
 * Google Maps API key is kept server-side. Frontend calls backend proxy.
 * Falls back to direct API call if backend proxy fails and key is available.
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
    let index = 0, lat = 0, lng = 0;
    while (index < encoded.length) {
        let b: number, shift = 0, result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lat += (result & 1) ? ~(result >> 1) : (result >> 1);
        shift = 0; result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lng += (result & 1) ? ~(result >> 1) : (result >> 1);
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
    _apiKey?: string,
): Promise<DirectionsResult | null> {
    // Use backend proxy (API key stays server-side)
    try {
        const url =
            `${Config.BACKEND_URL}/api/v1/directions` +
            `?origin_lat=${origin.lat}&origin_lon=${origin.lon}` +
            `&dest_lat=${destination.latitude}&dest_lon=${destination.longitude}`;

        const res = await fetch(url);
        if (!res.ok) return null;
        const data: any = await res.json();
        return parseDirectionsResponse(data);
    } catch {
        return null;
    }
}
