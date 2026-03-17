import { useEffect, useRef } from 'react';
import { Config } from '../config';
import { useAlertStore } from '../store/useAlertStore';
import { Alert as AlertType, Herd } from './api';

export const useWebSocket = () => {
    const ws = useRef<WebSocket | null>(null);
    const { setHerds, setActiveAlerts, addAlert, setLastUpdated, setLoading } = useAlertStore();
    const retryTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const retryCount = useRef(0);

    const connect = () => {
        if (ws.current?.readyState === WebSocket.OPEN) return;

        setLoading(true);
        const socket = new WebSocket(Config.BACKEND_WS);
        ws.current = socket;

        socket.onopen = () => {
            retryCount.current = 0;
            setLoading(false);
            console.log('[WS] Connected to SafeRoute live feed');
        };

        socket.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                setLastUpdated(new Date());

                if (msg.type === 'snapshot') {
                    // Initial full snapshot
                    if (msg.herds) setHerds(msg.herds as Herd[]);
                    if (msg.alerts) setActiveAlerts(msg.alerts as AlertType[]);
                } else if (msg.type === 'tick') {
                    // Incremental update from simulator tick
                    if (msg.data?.herds) {
                        msg.data.herds.forEach((h: any) => {
                            if (h.alert_level) {
                                // Alert fired — we'll refresh from API
                            }
                        });
                    }
                }
            } catch (e) {
                console.warn('[WS] Parse error:', e);
            }
        };

        socket.onerror = (e) => {
            console.warn('[WS] Error:', e);
            setLoading(false);
        };

        socket.onclose = () => {
            setLoading(false);
            // Exponential backoff retry
            const delay = Math.min(1000 * 2 ** retryCount.current, 30000);
            retryCount.current += 1;
            console.log(`[WS] Disconnected. Retry in ${delay}ms`);
            retryTimeout.current = setTimeout(connect, delay);
        };
    };

    useEffect(() => {
        connect();
        return () => {
            if (retryTimeout.current) clearTimeout(retryTimeout.current);
            ws.current?.close();
        };
    }, []);

    return { isConnected: ws.current?.readyState === WebSocket.OPEN };
};
