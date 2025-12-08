#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { initMqttClient, getMqttClient } from "./mqtt-client.js";
import {
  toolDefinitions,
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

// Environment variables for MQTT configuration
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || process.env.VITE_MQTT_URL || "";
const MQTT_USERNAME = process.env.MQTT_USERNAME || process.env.VITE_MQTT_USERNAME || "";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || process.env.VITE_MQTT_PASSWORD || "";

async function main() {
  console.error("[MCP-Printer] Starting server...");

  // Initialize MQTT client
  if (MQTT_BROKER_URL) {
    console.error(`[MCP-Printer] MQTT Broker: ${MQTT_BROKER_URL}`);
    initMqttClient({
      brokerUrl: MQTT_BROKER_URL,
      username: MQTT_USERNAME || undefined,
      password: MQTT_PASSWORD || undefined,
    });

    try {
      await getMqttClient()?.connect();
      console.error("[MCP-Printer] MQTT connected successfully");
    } catch (err) {
      console.error("[MCP-Printer] MQTT connection failed:", err);
    }
  } else {
    console.error("[MCP-Printer] Warning: MQTT_BROKER_URL not configured");
  }

  // Create MCP server
  const server = new Server(
    {
      name: "mcp-printer",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: toolDefinitions,
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    console.error(`[MCP-Printer] Tool called: ${name}`);
    console.error(`[MCP-Printer] Arguments:`, JSON.stringify(args, null, 2));

    try {
      let result: string;

      switch (name) {
        case "move_axis": {
          const params = MoveAxisSchema.parse(args);
          result = await moveAxis(params);
          break;
        }

        case "set_temperature": {
          const params = SetTemperatureSchema.parse(args);
          result = await setTemperature(params);
          break;
        }

        case "home_axis": {
          const params = HomeAxisSchema.parse(args);
          result = await homeAxis(params);
          break;
        }

        case "print_control": {
          const params = PrintControlSchema.parse(args);
          result = await printControl(params);
          break;
        }

        case "print_file": {
          const params = PrintFileSchema.parse(args);
          result = await printFile(params);
          break;
        }

        case "get_printer_info": {
          const params = GetPrinterStatusSchema.parse(args);
          result = await getPrinterStatus(params);
          break;
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      console.error(`[MCP-Printer] Result: ${result}`);

      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[MCP-Printer] Error: ${errorMessage}`);

      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[MCP-Printer] Server running on stdio");
}

main().catch((error) => {
  console.error("[MCP-Printer] Fatal error:", error);
  process.exit(1);
});
