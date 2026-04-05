import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Config } from '../config';
import { useAlertStore } from '../store/useAlertStore';
import { Alert as AlertType, Herd, getActiveAlerts } from './api';

export const useWebSocket = () => {
    const ws = useRef<WebSocket | null>(null);
    const { setHerds, setActiveAlerts, addAlert, setLastUpdated, setLoading } = useAlertStore();
    const retryTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const staleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const retryCount = useRef(0);
    const appState = useRef(AppState.currentState);

    const resetStaleTimer = () => {
        if (staleTimeout.current) clearTimeout(staleTimeout.current);
        // If no message received in 90s (server pings every 30s), reconnect
        staleTimeout.current = setTimeout(() => {
            console.log('[WS] No message in 90s, reconnecting...');
            ws.current?.close();
        }, 90_000);
    };

    const connect = () => {
        // Prevent stacking: clear pending retry before new connection
        if (retryTimeout.current) {
            clearTimeout(retryTimeout.current);
            retryTimeout.current = null;
        }
        if (ws.current?.readyState === WebSocket.OPEN || ws.current?.readyState === WebSocket.CONNECTING) return;

        setLoading(true);
        const socket = new WebSocket(Config.BACKEND_WS);
        ws.current = socket;

        socket.onopen = () => {
            retryCount.current = 0;
            setLoading(false);
            resetStaleTimer();
            console.log('[WS] Connected to SafeRoute live feed');
        };

        socket.onmessage = (event) => {
            resetStaleTimer();
            try {
                const msg = JSON.parse(event.data);
                setLastUpdated(new Date());

                if (msg.type === 'snapshot') {
                    // Initial full snapshot
                    if (msg.herds) setHerds(msg.herds as Herd[]);
                    if (msg.alerts) setActiveAlerts(msg.alerts as AlertType[]);
                } else if (msg.type === 'tick') {
                    // Incremental update — update herd positions
                    if (msg.data?.herds) {
                        const hasNewAlert = msg.data.herds.some((h: any) => h.alert_level);
                        if (hasNewAlert) {
                            getActiveAlerts()
                                .then(alerts => setActiveAlerts(alerts))
                                .catch(() => {});
                        }
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

        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                console.log('[WS] App has come to the foreground, reconnecting WebSocket...');
                // Force reconnect
                if (retryTimeout.current) clearTimeout(retryTimeout.current);
                if (ws.current) {
                    ws.current.close();
                }
                connect();
            }
            appState.current = nextAppState;
        });

        return () => {
            if (retryTimeout.current) clearTimeout(retryTimeout.current);
            if (staleTimeout.current) clearTimeout(staleTimeout.current);
            ws.current?.close();
            subscription.remove();
        };
    }, []);

    return { isConnected: ws.current?.readyState === WebSocket.OPEN };
};
