import { useState, useEffect, useRef } from "react";
import { getUserPrintersWithGroup } from "@shared/services/supabaseService/printerList";
import { onDashStatusMessage } from "@shared/services/mqttService";
import type { PrinterData } from "@/types/ai";

/**
 * Hook to manage printer states, including initial loading from Supabase
 * and real-time updates via MQTT.
 */
export function useAIPrinters(userId: string | undefined) {
    const [printers, setPrinters] = useState<PrinterData[]>([]);

    const totalPrinters = printers.length;
    const connectedCount = printers.filter((p) => p.connected).length;
    const printingCount = printers.filter((p) => p.state === 'printing').length;

    // Load printers from Supabase
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                if (!userId) return;
                const rows = await getUserPrintersWithGroup(userId);
                if (!active) return;
                const mapped: PrinterData[] = (rows || []).map((r) => ({
                    id: r.id,
                    name: r.name || r.model || r.device_uuid || 'Unknown Printer',
                    model: r.model || 'Unknown Model',
                    group_id: r.group_id,
                    group: r.group,
                    state: 'connecting' as const,
                    connected: false,
                    printing: false,
                    pending: true,
                    completion: undefined,
                    temperature: {
                        tool_actual: 0,
                        tool_target: 0,
                        bed_actual: 0,
                        bed_target: 0,
                    },
                    print_time_left: undefined,
                    current_file: undefined,
                    device_uuid: r.device_uuid,
                    manufacture_id: r.manufacture_id,
                }));
                setPrinters(mapped);
            } catch (e) {
                console.error('[AI] load printers failed', e);
            }
        })();
        return () => { active = false; };
    }, [userId]);

    // MQTT Real-time Status Updates
    useEffect(() => {
        if (printers.length === 0) return;

        console.log('[AI MQTT] Printer monitoring started:', printers.length);

        const timeouts: Record<string, number> = {};
        const TIMEOUT_DURATION = 3000; // 3 seconds

        const startTimeoutFor = (uuid?: string, currentState?: string) => {
            if (!uuid) return;

            if (timeouts[uuid]) {
                try { clearTimeout(timeouts[uuid]); } catch (err) { console.warn('clearTimeout failed:', err); }
            }

            timeouts[uuid] = window.setTimeout(() => {
                console.log('[AI MQTT] Timeout:', uuid, '- changed to disconnected');
                setPrinters((prev) => prev.map(p => {
                    if (p.device_uuid === uuid) {
                        return { ...p, state: 'disconnected', connected: false, pending: false };
                    }
                    return p;
                }));
            }, TIMEOUT_DURATION);
        };

        // Initialize timeouts
        setPrinters((prev) => {
            prev.forEach((p) => startTimeoutFor(p.device_uuid, p.state));
            return prev;
        });

        // MQTT Message Handler
        const off = onDashStatusMessage((uuid, data) => {
            setPrinters((prev) => {
                const next = [...prev];
                const idx = next.findIndex(p => p.device_uuid === uuid);
                if (idx >= 0) {
                    const bed = data?.temperature_info?.bed;
                    const toolAny = data?.temperature_info?.tool;
                    const tool = toolAny?.tool0 ?? toolAny;
                    const flags = data?.printer_status?.flags ?? {};
                    const isConnected = Boolean(
                        data?.connected ||
                        flags.operational || flags.printing || flags.paused || flags.ready || flags.error
                    );
                    const nextState: PrinterData['state'] =
                        flags.printing ? 'printing' :
                            flags.paused ? 'paused' :
                                flags.error ? 'error' :
                                    (isConnected ? 'idle' : 'disconnected');

                    // Reset timeout on data receipt
                    startTimeoutFor(uuid, nextState);

                    next[idx] = {
                        ...next[idx],
                        pending: false,
                        state: nextState,
                        connected: isConnected,
                        printing: (flags?.printing ?? data?.printer_status?.printing) ?? next[idx].printing,
                        completion: typeof data?.progress?.completion === 'number' ? data.progress.completion : next[idx].completion,
                        temperature: {
                            tool_actual: typeof tool?.actual === 'number' ? tool.actual : next[idx].temperature.tool_actual,
                            tool_target: typeof tool?.target === 'number' ? tool.target : next[idx].temperature.tool_target,
                            bed_actual: typeof bed?.actual === 'number' ? bed.actual : next[idx].temperature.bed_actual,
                            bed_target: typeof bed?.target === 'number' ? bed.target : next[idx].temperature.bed_target,
                        },
                        print_time_left: data?.progress?.print_time_left ?? next[idx].print_time_left,
                        current_file: data?.printer_status?.current_file ?? next[idx].current_file,
                    };
                }
                return next;
            });
        });

        console.log('[AI MQTT] Handler registered');

        return () => {
            console.log('[AI MQTT] Cleanup - clearing timeouts');
            off();
            Object.values(timeouts).forEach(t => { try { clearTimeout(t); } catch (err) { console.warn('clearTimeout failed:', err); } });
        };
    }, [printers.length]);

    return {
        printers,
        connectedCount,
        printingCount,
        totalPrinters,
    };
}
