export interface PrinterGroup {
    id: string;
    name: string;
    description?: string;
    color: string;
    created_at: string;
    updated_at: string;
}

export interface PrinterData {
    id: string;
    name: string;
    model: string;
    group_id?: string;
    group?: PrinterGroup;
    state: "idle" | "printing" | "paused" | "error" | "connecting" | "disconnected";
    connected: boolean;
    printing: boolean;
    pending?: boolean;
    completion?: number;
    temperature: {
        tool_actual: number;
        tool_target: number;
        bed_actual: number;
        bed_target: number;
    };
    print_time_left?: number;
    current_file?: string;
    device_uuid?: string;
    manufacture_id?: string;
}

export interface GCodeInfo {
    printTime?: string;
    filamentLength?: string;
    filamentWeight?: string;
    filamentCost?: string;
    layerCount?: number;
    layerHeight?: number;
    modelSize?: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
    nozzleTemp?: number;
    bedTemp?: number;
    printerName?: string;
}

export type SubscriptionPlan = 'free' | 'pro' | 'enterprise';

export interface PrintSettings {
    support_enable: boolean;
    support_angle: number;
    layer_height: number;
    line_width: number;
    speed_print: number;
    material_diameter: number;
    material_flow: number;
    infill_sparse_density: number;
    wall_line_count: number;
    top_layers: number;
    bottom_layers: number;
    adhesion_type: 'none' | 'skirt' | 'brim' | 'raft';
}
