#!/usr/bin/env node

import http from "http";
import { initMqttClient, getMqttClient } from "./mqtt-client.js";
import {
  moveAxis,
  setTemperature,
  homeAxis,
  printControl,
  printFile,
  getPrinterStatus,
  MoveAxisSchema,
  SetTemperatureSchema,
  HomeAxisSchema,
  PrintControlSchema,
  PrintFileSchema,
  GetPrinterStatusSchema,
} from "./tools.js";

// Environment variables
const PORT = parseInt(process.env.PORT || "3100", 10);
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || process.env.VITE_MQTT_URL || "";
const MQTT_USERNAME = process.env.MQTT_USERNAME || process.env.VITE_MQTT_USERNAME || "";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || process.env.VITE_MQTT_PASSWORD || "";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Parse JSON body
async function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

// Send JSON response
function sendJson(res: http.ServerResponse, status: number, data: any) {
  res.writeHead(status, { ...corsHeaders, "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

// Request handler
async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method || "GET";

  // Handle CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  console.log(`[HTTP] ${method} ${path}`);

  try {
    // Health check
    if (path === "/health" && method === "GET") {
      const mqttConnected = getMqttClient()?.isConnected() || false;
      sendJson(res, 200, {
        status: "ok",
        mqtt: mqttConnected ? "connected" : "disconnected",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // List available tools
    if (path === "/tools" && method === "GET") {
      sendJson(res, 200, {
        tools: [
          { name: "move_axis", description: "Move printer axis", endpoint: "POST /printer/move" },
          { name: "set_temperature", description: "Set nozzle/bed temperature", endpoint: "POST /printer/temperature" },
          { name: "home_axis", description: "Home printer axes", endpoint: "POST /printer/home" },
          { name: "print_control", description: "Pause/Resume/Cancel print", endpoint: "POST /printer/control" },
          { name: "print_file", description: "Start printing a file", endpoint: "POST /printer/print" },
          { name: "get_printer_info", description: "Get printer info", endpoint: "GET /printer/:deviceUuid/info" },
        ],
      });
      return;
    }

    // Printer control endpoints
    if (path === "/printer/move" && method === "POST") {
      const body = await parseBody(req);
      const params = MoveAxisSchema.parse(body);
      const result = await moveAxis(params);
      sendJson(res, 200, { success: true, message: result });
      return;
    }

    if (path === "/printer/temperature" && method === "POST") {
      const body = await parseBody(req);
      const params = SetTemperatureSchema.parse(body);
      const result = await setTemperature(params);
      sendJson(res, 200, { success: true, message: result });
      return;
    }

    if (path === "/printer/home" && method === "POST") {
      const body = await parseBody(req);
      const params = HomeAxisSchema.parse(body);
      const result = await homeAxis(params);
      sendJson(res, 200, { success: true, message: result });
      return;
    }

    if (path === "/printer/control" && method === "POST") {
      const body = await parseBody(req);
      const params = PrintControlSchema.parse(body);
      const result = await printControl(params);
      sendJson(res, 200, { success: true, message: result });
      return;
    }

    if (path === "/printer/print" && method === "POST") {
      const body = await parseBody(req);
      const params = PrintFileSchema.parse(body);
      const result = await printFile(params);
      sendJson(res, 200, { success: true, message: result });
      return;
    }

    // Get printer info (GET with deviceUuid in path)
    const infoMatch = path.match(/^\/printer\/([^/]+)\/info$/);
    if (infoMatch && method === "GET") {
      const deviceUuid = infoMatch[1];
      const params = GetPrinterStatusSchema.parse({ deviceUuid });
      const result = await getPrinterStatus(params);
      sendJson(res, 200, { success: true, data: JSON.parse(result) });
      return;
    }

    // 404 Not Found
    sendJson(res, 404, { error: "Not Found", path });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[HTTP] Error: ${message}`);
    sendJson(res, 400, { success: false, error: message });
  }
}

// Start server
async function main() {
  console.log("[MCP-Printer HTTP] Starting server...");

  // Initialize MQTT
  if (MQTT_BROKER_URL) {
    console.log(`[MCP-Printer HTTP] MQTT Broker: ${MQTT_BROKER_URL}`);
    initMqttClient({
      brokerUrl: MQTT_BROKER_URL,
      username: MQTT_USERNAME || undefined,
      password: MQTT_PASSWORD || undefined,
    });

    try {
      await getMqttClient()?.connect();
      console.log("[MCP-Printer HTTP] MQTT connected");
    } catch (err) {
      console.error("[MCP-Printer HTTP] MQTT connection failed:", err);
    }
  } else {
    console.error("[MCP-Printer HTTP] Warning: MQTT_BROKER_URL not set");
  }

  // Create HTTP server
  const server = http.createServer(handleRequest);

  server.listen(PORT, () => {
    console.log(`[MCP-Printer HTTP] Server running on http://localhost:${PORT}`);
    console.log(`[MCP-Printer HTTP] API Endpoints:`);
    console.log(`  GET  /health              - Health check`);
    console.log(`  GET  /tools               - List available tools`);
    console.log(`  POST /printer/move        - Move axis`);
    console.log(`  POST /printer/temperature - Set temperature`);
    console.log(`  POST /printer/home        - Home axes`);
    console.log(`  POST /printer/control     - Pause/Resume/Cancel`);
    console.log(`  POST /printer/print       - Start print`);
    console.log(`  GET  /printer/:uuid/info  - Get printer info`);
  });
}

main().catch((error) => {
  console.error("[MCP-Printer HTTP] Fatal error:", error);
  process.exit(1);
});
