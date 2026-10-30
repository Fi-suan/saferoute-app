/**
 * Supabase Client — SafeRoute / Sapa Jol
 *
 * Provides Realtime subscriptions to incident_reports so that
 * when one device submits a report or confirms resolution,
 * all connected devices see it instantaneously!
 */
import { createClient } from '@supabase/supabase-js';
import { Config } from '../config';

export const supabase = createClient(Config.SUPABASE_URL, Config.SUPABASE_ANON_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    },
    realtime: {
        params: {
            eventsPerSecond: 10,
        },
    },
});
