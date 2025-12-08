import { z } from "zod";
import { getMqttClient } from "./mqtt-client.js";

// Tool schemas
export const MoveAxisSchema = z.object({
  deviceUuid: z.string().describe("Target printer device UUID"),
  axis: z.enum(["x", "y", "z", "e"]).describe("Axis to move (x, y, z, or e for extruder)"),
  distance: z.number().describe("Distance to move in mm (positive or negative)"),
  feedrate: z.number().optional().default(1000).describe("Movement speed in mm/min (default: 1000)"),
});

export const SetTemperatureSchema = z.object({
  deviceUuid: z.string().describe("Target printer device UUID"),
  target: z.enum(["nozzle", "bed"]).describe("Temperature target (nozzle or bed)"),
  temperature: z.number().min(0).max(300).describe("Target temperature in Celsius"),
  wait: z.boolean().optional().default(false).describe("Wait for temperature to be reached"),
});

export const HomeAxisSchema = z.object({
  deviceUuid: z.string().describe("Target printer device UUID"),
  axes: z.enum(["X", "Y", "Z", "XY", "XZ", "YZ", "XYZ", "ALL"]).optional().default("XYZ").describe("Axes to home (default: XYZ)"),
});

export const PrintControlSchema = z.object({
  deviceUuid: z.string().describe("Target printer device UUID"),
  action: z.enum(["pause", "resume", "cancel"]).describe("Print control action"),
});

export const PrintFileSchema = z.object({
  deviceUuid: z.string().describe("Target printer device UUID"),
  filename: z.string().describe("G-code filename to print"),
  origin: z.enum(["local", "sdcard"]).describe("File location (local storage or SD card)"),
});

export const GetPrinterStatusSchema = z.object({
  deviceUuid: z.string().describe("Target printer device UUID"),
});

// Tool implementations
export async function moveAxis(params: z.infer<typeof MoveAxisSchema>): Promise<string> {
  const client = getMqttClient();
  if (!client) {
    throw new Error("MQTT client not initialized");
  }

  const { deviceUuid, axis, distance, feedrate } = params;
  const topic = `control/${deviceUuid}`;

  const payload = {
    type: "move",
    mode: "relative",
    [axis]: distance,
    feedrate,
  };

  await client.publish(topic, payload, 1);

  return `Successfully sent move command: ${axis.toUpperCase()} axis ${distance > 0 ? "+" : ""}${distance}mm at ${feedrate}mm/min`;
}

export async function setTemperature(params: z.infer<typeof SetTemperatureSchema>): Promise<string> {
  const client = getMqttClient();
  if (!client) {
    throw new Error("MQTT client not initialized");
  }

  const { deviceUuid, target, temperature, wait } = params;
  const topic = `control/${deviceUuid}`;

  // tool: -1 for bed, 0 for nozzle
  const tool = target === "bed" ? -1 : 0;

  const payload: Record<string, unknown> = {
    type: "set_temperature",
    tool,
    temperature,
  };

  if (wait) {
    payload.wait = true;
  }

  await client.publish(topic, payload, 1);

  return `Successfully set ${target} temperature to ${temperature}°C${wait ? " (waiting)" : ""}`;
}

export async function homeAxis(params: z.infer<typeof HomeAxisSchema>): Promise<string> {
  const client = getMqttClient();
  if (!client) {
    throw new Error("MQTT client not initialized");
  }

  const { deviceUuid, axes } = params;
  const topic = `control/${deviceUuid}`;

  const axesString = axes === "ALL" ? "XYZ" : axes;

  const payload = {
    type: "home",
    axes: axesString,
  };

  await client.publish(topic, payload, 1);

  return `Successfully sent home command for ${axesString} axes`;
}

export async function printControl(params: z.infer<typeof PrintControlSchema>): Promise<string> {
  const client = getMqttClient();
  if (!client) {
    throw new Error("MQTT client not initialized");
  }

  const { deviceUuid, action } = params;
  const topic = `control/${deviceUuid}`;

  const payload = {
    type: action,
  };

  await client.publish(topic, payload, 1);

  const actionText = {
    pause: "paused",
    resume: "resumed",
    cancel: "cancelled",
  };

  return `Print ${actionText[action]} successfully`;
}

export async function printFile(params: z.infer<typeof PrintFileSchema>): Promise<string> {
  const client = getMqttClient();
  if (!client) {
    throw new Error("MQTT client not initialized");
  }

  const { deviceUuid, filename, origin } = params;
  const topic = `octoprint/gcode_in/${deviceUuid}`;

  const jobId = filename.replace(/\.[^/.]+$/, "");

  const payload = {
    action: "print",
    filename,
    origin,
    job_id: jobId,
  };

  await client.publish(topic, payload, 1);

  return `Started printing "${filename}" from ${origin}`;
}

export async function getPrinterStatus(params: z.infer<typeof GetPrinterStatusSchema>): Promise<string> {
  // Note: This is a simplified version. In a real implementation,
  // you would subscribe to the status topic and wait for a response.
  const { deviceUuid } = params;

  return JSON.stringify({
    deviceUuid,
    note: "To get real-time printer status, the printer must be connected and sending status updates via MQTT. Status is typically available on topic: dash_status/{deviceUuid}",
    availableCommands: [
      "move_axis - Move printer axis",
      "set_temperature - Set nozzle/bed temperature",
      "home_axis - Home printer axes",
      "print_control - Pause/Resume/Cancel print",
      "print_file - Start printing a file",
    ],
  }, null, 2);
}

// Tool definitions for MCP
export const toolDefinitions = [
  {
    name: "move_axis",
    description: "Move a 3D printer axis by a specified distance. Use positive values to move in positive direction, negative for opposite.",
    inputSchema: {
      type: "object",
      properties: {
        deviceUuid: { type: "string", description: "Target printer device UUID" },
        axis: { type: "string", enum: ["x", "y", "z", "e"], description: "Axis to move (x, y, z, or e for extruder)" },
        distance: { type: "number", description: "Distance to move in mm (positive or negative)" },
        feedrate: { type: "number", description: "Movement speed in mm/min (default: 1000)" },
      },
      required: ["deviceUuid", "axis", "distance"],
    },
  },
  {
    name: "set_temperature",
    description: "Set the target temperature for the printer's nozzle or heated bed.",
    inputSchema: {
      type: "object",
      properties: {
        deviceUuid: { type: "string", description: "Target printer device UUID" },
        target: { type: "string", enum: ["nozzle", "bed"], description: "Temperature target" },
        temperature: { type: "number", description: "Target temperature in Celsius (0-300)" },
        wait: { type: "boolean", description: "Wait for temperature to be reached (default: false)" },
      },
      required: ["deviceUuid", "target", "temperature"],
    },
  },
  {
    name: "home_axis",
    description: "Home (move to origin) the specified printer axes. This is required before printing.",
    inputSchema: {
      type: "object",
      properties: {
        deviceUuid: { type: "string", description: "Target printer device UUID" },
        axes: { type: "string", enum: ["X", "Y", "Z", "XY", "XZ", "YZ", "XYZ", "ALL"], description: "Axes to home (default: XYZ)" },
      },
      required: ["deviceUuid"],
    },
  },
  {
    name: "print_control",
    description: "Control an ongoing print job - pause, resume, or cancel.",
    inputSchema: {
      type: "object",
      properties: {
        deviceUuid: { type: "string", description: "Target printer device UUID" },
        action: { type: "string", enum: ["pause", "resume", "cancel"], description: "Print control action" },
      },
      required: ["deviceUuid", "action"],
    },
  },
  {
    name: "print_file",
    description: "Start printing a G-code file from the printer's local storage or SD card.",
    inputSchema: {
      type: "object",
      properties: {
        deviceUuid: { type: "string", description: "Target printer device UUID" },
        filename: { type: "string", description: "G-code filename to print" },
        origin: { type: "string", enum: ["local", "sdcard"], description: "File location" },
      },
      required: ["deviceUuid", "filename", "origin"],
    },
  },
  {
    name: "get_printer_info",
    description: "Get information about available printer commands and how to use them.",
    inputSchema: {
      type: "object",
      properties: {
        deviceUuid: { type: "string", description: "Target printer device UUID" },
      },
      required: ["deviceUuid"],
    },
  },
];
