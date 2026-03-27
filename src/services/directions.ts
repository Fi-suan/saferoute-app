/**
 * directions.ts — Google Directions API
 *
 * Fetches a driving route and decodes the overview polyline.
 * Free tier: $200/month credit = ~40 000 requests/month.
 */

export interface DirectionsStep {
    instruction: string;   // HTML stripped
    distance: string;      // e.g. "12.4 км"
    duration: string;      // e.g. "8 мин"
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

export async function fetchDirections(
    origin: { lat: number; lon: number },
    destination: { latitude: number; longitude: number },
    apiKey: string,
): Promise<DirectionsResult | null> {
    try {
        const url =
            `https://maps.googleapis.com/maps/api/directions/json` +
            `?origin=${origin.lat},${origin.lon}` +
            `&destination=${destination.latitude},${destination.longitude}` +
            `&key=${apiKey}` +
            `&language=ru&mode=driving`;

        const res = await fetch(url);
        if (!res.ok) return null;
        const data: any = await res.json();
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
    } catch {
        return null;
    }
}
