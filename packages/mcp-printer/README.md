# MCP Printer - 3D Printer Remote Control

MCP (Model Context Protocol) server for controlling 3D printers via MQTT.

## Features

- **move_axis**: Move X, Y, Z axes or extruder
- **set_temperature**: Set nozzle/bed temperature
- **home_axis**: Home printer axes
- **print_control**: Pause/Resume/Cancel print
- **print_file**: Start printing a G-code file
- **get_printer_info**: Get available commands

## Installation

```bash
cd packages/mcp-printer
npm install
npm run build
```

## Configuration

### Environment Variables

```bash
MQTT_BROKER_URL=wss://your-mqtt-broker:port
MQTT_USERNAME=your-username
MQTT_PASSWORD=your-password
```

### Claude Code Configuration

Add to your `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "printer": {
      "command": "node",
      "args": ["C:/path/to/FACTOR-HIBRID-r1.0/packages/mcp-printer/dist/index.js"],
      "env": {
        "MQTT_BROKER_URL": "wss://your-mqtt-broker:port",
        "MQTT_USERNAME": "your-username",
        "MQTT_PASSWORD": "your-password"
      }
    }
  }
}
```

Or using tsx for development:

```json
{
  "mcpServers": {
    "printer": {
      "command": "npx",
      "args": ["tsx", "C:/path/to/FACTOR-HIBRID-r1.0/packages/mcp-printer/src/index.ts"],
      "env": {
        "MQTT_BROKER_URL": "wss://your-mqtt-broker:port",
        "MQTT_USERNAME": "your-username",
        "MQTT_PASSWORD": "your-password"
      }
    }
  }
}
```

## Usage Examples

Once configured, you can ask Claude to control your printer:

- "Move the X axis 10mm to the right"
- "Set the nozzle temperature to 200°C"
- "Home all axes"
- "Pause the current print"
- "Start printing benchy.gcode from local storage"

## Tool Reference

### move_axis

Move a printer axis by a specified distance.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| deviceUuid | string | Yes | Target printer UUID |
| axis | "x" \| "y" \| "z" \| "e" | Yes | Axis to move |
| distance | number | Yes | Distance in mm |
| feedrate | number | No | Speed in mm/min (default: 1000) |

### set_temperature

Set target temperature for nozzle or bed.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| deviceUuid | string | Yes | Target printer UUID |
| target | "nozzle" \| "bed" | Yes | Temperature target |
| temperature | number | Yes | Temperature in °C |
| wait | boolean | No | Wait for target temp |

### home_axis

Home printer axes.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| deviceUuid | string | Yes | Target printer UUID |
| axes | string | No | Axes to home (default: "XYZ") |

### print_control

Control print job.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| deviceUuid | string | Yes | Target printer UUID |
| action | "pause" \| "resume" \| "cancel" | Yes | Control action |

### print_file

Start printing a file.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| deviceUuid | string | Yes | Target printer UUID |
| filename | string | Yes | G-code filename |
| origin | "local" \| "sdcard" | Yes | File location |

## MQTT Topics

- Control: `control/{deviceUuid}`
- G-code commands: `octoprint/gcode_in/{deviceUuid}`
- Status (subscribe): `dash_status/{deviceUuid}`
