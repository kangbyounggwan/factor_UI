import mqtt, { MqttClient, IClientOptions } from "mqtt";

export interface MqttConfig {
  brokerUrl: string;
  username?: string;
  password?: string;
  clientId?: string;
}

class PrinterMqttClient {
  private client: MqttClient | null = null;
  private connected = false;
  private config: MqttConfig;
  private connectPromise: Promise<void> | null = null;

  constructor(config: MqttConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.connected && this.client) {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = new Promise((resolve, reject) => {
      const clientId = this.config.clientId || `mcp-printer-${Math.random().toString(16).slice(2, 10)}`;

      const options: IClientOptions = {
        clientId,
        username: this.config.username,
        password: this.config.password,
        reconnectPeriod: 3000,
        clean: true,
        keepalive: 60,
      };

      console.error(`[MCP-MQTT] Connecting to ${this.config.brokerUrl}...`);
      this.client = mqtt.connect(this.config.brokerUrl, options);

      const timeout = setTimeout(() => {
        reject(new Error("MQTT connection timeout"));
      }, 10000);

      this.client.on("connect", () => {
        clearTimeout(timeout);
        this.connected = true;
        console.error("[MCP-MQTT] Connected successfully");
        resolve();
      });

      this.client.on("error", (err) => {
        clearTimeout(timeout);
        console.error("[MCP-MQTT] Connection error:", err.message);
        reject(err);
      });

      this.client.on("close", () => {
        this.connected = false;
        console.error("[MCP-MQTT] Connection closed");
      });

      this.client.on("reconnect", () => {
        console.error("[MCP-MQTT] Reconnecting...");
      });
    });

    return this.connectPromise;
  }

  async publish(topic: string, message: unknown, qos: 0 | 1 | 2 = 1): Promise<void> {
    if (!this.client || !this.connected) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      const payload = typeof message === "string" ? message : JSON.stringify(message);

      console.error(`[MCP-MQTT] Publishing to ${topic}:`, payload);

      this.client!.publish(topic, payload, { qos }, (err) => {
        if (err) {
          console.error("[MCP-MQTT] Publish error:", err.message);
          reject(err);
        } else {
          console.error("[MCP-MQTT] Published successfully");
          resolve();
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      return new Promise((resolve) => {
        this.client!.end(false, {}, () => {
          this.connected = false;
          this.client = null;
          this.connectPromise = null;
          resolve();
        });
      });
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// Singleton instance
let mqttClient: PrinterMqttClient | null = null;

export function initMqttClient(config: MqttConfig): PrinterMqttClient {
  if (!mqttClient) {
    mqttClient = new PrinterMqttClient(config);
  }
  return mqttClient;
}

export function getMqttClient(): PrinterMqttClient | null {
  return mqttClient;
}

export { PrinterMqttClient };
