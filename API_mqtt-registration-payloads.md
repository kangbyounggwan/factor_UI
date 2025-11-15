# MQTT Device Registration Payloads

## Overview
When a user attempts to register a device via the web setup page (`/setup/{uuid}`), the system sends MQTT messages to notify the OctoPrint plugin about the registration status.

**Topic**: `device/{uuid}/registration`
**QoS**: 1 (guaranteed delivery)

---

## 1. Success Payload (등록 성공)

Sent when device registration completes successfully.

```json
{
  "status": "registered",
  "device_name": "메인 프린터",
  "registered_at": "2025-01-13T10:30:45.123Z",
  "user_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Fields:
- **status**: `"registered"` - Registration succeeded
- **device_name**: User-provided printer name
- **registered_at**: ISO 8601 timestamp of registration completion
- **user_id**: Supabase UUID of the user who registered the device

---

## 2. Timeout Payload (등록 기간 만료)

Sent when the 5-minute registration window expires before the user completes registration.

```json
{
  "status": "timeout",
  "error": "Registration window expired (5 minutes)",
  "attempted_at": "2025-01-13T10:35:45.123Z",
  "timeout_duration_ms": 300000
}
```

### Fields:
- **status**: `"timeout"` - Registration window expired
- **error**: Human-readable error message
- **attempted_at**: ISO 8601 timestamp when timeout was detected
- **timeout_duration_ms**: Timeout duration in milliseconds (5 minutes = 300000ms)

---

## 3. Failure Payload (등록 실패)

Sent when registration fails due to database errors or other issues.

```json
{
  "status": "failed",
  "error": "이 디바이스는 이미 등록되었습니다.",
  "attempted_at": "2025-01-13T10:30:45.123Z",
  "error_code": "23505"
}
```

### Fields:
- **status**: `"failed"` - Registration failed
- **error**: Human-readable error message (Korean)
- **attempted_at**: ISO 8601 timestamp of the failed attempt
- **error_code**: (Optional) Database error code or system error code

### Common Error Codes:
- **23505**: Duplicate key violation (device already registered)
- **(others)**: Various database or system errors

---

## OctoPrint Plugin Implementation Example

```python
import json
import paho.mqtt.client as mqtt

def on_mqtt_connect(client, userdata, flags, rc):
    """Subscribe to registration topic when connected to MQTT broker"""
    device_uuid = "your-device-uuid-here"
    topic = f"device/{device_uuid}/registration"
    client.subscribe(topic, qos=1)
    print(f"Subscribed to {topic}")

def on_mqtt_message(client, userdata, msg):
    """Handle incoming registration messages"""
    try:
        payload = json.loads(msg.payload.decode('utf-8'))
        status = payload.get("status")

        if status == "registered":
            # Registration successful
            device_name = payload.get("device_name")
            registered_at = payload.get("registered_at")
            user_id = payload.get("user_id")

            print(f"✓ Device registered successfully!")
            print(f"  Device Name: {device_name}")
            print(f"  Registered At: {registered_at}")
            print(f"  User ID: {user_id}")

            # Clean up: Unsubscribe from registration topic
            client.unsubscribe(msg.topic)

            # Proceed with device initialization
            initialize_device_connection()

        elif status == "timeout":
            # Registration timeout
            error = payload.get("error")
            timeout_duration = payload.get("timeout_duration_ms")

            print(f"✗ Registration timeout: {error}")
            print(f"  Timeout Duration: {timeout_duration}ms")

            # Clean up and prepare for new registration
            client.unsubscribe(msg.topic)
            prepare_for_new_registration()

        elif status == "failed":
            # Registration failed
            error = payload.get("error")
            error_code = payload.get("error_code")

            print(f"✗ Registration failed: {error}")
            if error_code:
                print(f"  Error Code: {error_code}")

            # Clean up and prepare for new registration
            client.unsubscribe(msg.topic)
            prepare_for_new_registration()

    except json.JSONDecodeError as e:
        print(f"Failed to parse MQTT message: {e}")
    except Exception as e:
        print(f"Error handling MQTT message: {e}")

def initialize_device_connection():
    """Called after successful registration"""
    # Start normal OctoPrint operations
    pass

def prepare_for_new_registration():
    """Called after timeout or failure"""
    # Generate new UUID and prepare for fresh registration
    pass

# MQTT client setup
client = mqtt.Client()
client.on_connect = on_mqtt_connect
client.on_message = on_mqtt_message

# Connect to broker
client.connect("mqtt.factor.io.kr", 1883, 60)
client.loop_start()
```

---

## Registration Flow Timeline

```
┌─────────────────────────────────────────────────────────────────┐
│ OctoPrint Plugin                                                │
├─────────────────────────────────────────────────────────────────┤
│ 1. Generate UUID                                                │
│ 2. Create setup URL: https://factor.io.kr/setup/{uuid}         │
│ 3. Subscribe to MQTT: device/{uuid}/registration               │
│ 4. Show QR code / URL to user                                   │
│ 5. Wait for MQTT message (5-minute window)                      │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Web Application (User Action)                                   │
├─────────────────────────────────────────────────────────────────┤
│ 1. User scans QR / opens URL                                    │
│ 2. Timestamp saved to localStorage                              │
│ 3. User logs in (if not authenticated)                          │
│ 4. User enters device name                                      │
│ 5. User clicks "설비 등록하기"                                   │
│                                                                 │
│ ┌─────────────── SUCCESS PATH ─────────────────┐               │
│ │ 6a. Save to database (edge_devices)          │               │
│ │ 7a. Publish MQTT: status="registered"        │               │
│ │ 8a. Clear localStorage timer                 │               │
│ │ 9a. Navigate to dashboard                    │               │
│ └──────────────────────────────────────────────┘               │
│                                                                 │
│ ┌─────────────── FAILURE PATH ─────────────────┐               │
│ │ 6b. Database error occurs                    │               │
│ │ 7b. Publish MQTT: status="failed"            │               │
│ │ 8b. Show error toast to user                 │               │
│ └──────────────────────────────────────────────┘               │
│                                                                 │
│ ┌─────────────── TIMEOUT PATH ─────────────────┐               │
│ │ 6c. 5 minutes elapse without registration    │               │
│ │ 7c. Publish MQTT: status="timeout"           │               │
│ │ 8c. Show "등록 기간 만료" error page           │               │
│ └──────────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ OctoPrint Plugin (MQTT Message Received)                        │
├─────────────────────────────────────────────────────────────────┤
│ 1. Receive MQTT message                                         │
│ 2. Parse JSON payload                                           │
│ 3. Check status field                                           │
│                                                                 │
│ ┌─────────────── IF "registered" ─────────────┐                │
│ │ 4a. Unsubscribe from registration topic     │                │
│ │ 5a. Initialize device connection            │                │
│ │ 6a. Start normal operations                 │                │
│ └──────────────────────────────────────────────┘               │
│                                                                 │
│ ┌──────────── IF "timeout" or "failed" ───────┐                │
│ │ 4b. Unsubscribe from registration topic     │                │
│ │ 5b. Generate new UUID                       │                │
│ │ 6b. Create new setup URL                    │                │
│ │ 7b. Show new QR code to user                │                │
│ └──────────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Important Notes

1. **5-Minute Window**: Registration must be completed within 5 minutes of the first page access. The timer is stored in browser localStorage with key: `device_registration_start_{uuid}`

2. **QoS 1**: All messages use QoS 1 to ensure at-least-once delivery

3. **Unsubscribe After Message**: The plugin should unsubscribe from the registration topic after receiving any status message (success, timeout, or failure) to free up resources

4. **New UUID After Failure**: After timeout or failure, the plugin should generate a fresh UUID and create a new registration flow

5. **Graceful Degradation**: If MQTT message sending fails on the web side, the database registration still completes successfully (for success cases)

6. **Error Codes**: The `error_code` field in failure messages corresponds to PostgreSQL error codes when available

---

## Testing

### Test Success Case:
1. Generate UUID in plugin
2. Subscribe to `device/{uuid}/registration`
3. Open `https://factor.io.kr/setup/{uuid}` in browser
4. Complete registration within 5 minutes
5. Verify MQTT message with `status: "registered"`

### Test Timeout Case:
1. Generate UUID in plugin
2. Subscribe to `device/{uuid}/registration`
3. Open `https://factor.io.kr/setup/{uuid}` in browser
4. Wait more than 5 minutes
5. Try to register
6. Verify MQTT message with `status: "timeout"`

### Test Failure Case:
1. Register a device successfully
2. Try to register the same UUID again
3. Verify MQTT message with `status: "failed"` and `error_code: "23505"`
