import { supabase } from "../../integrations/supabase/client";

type Payload = {
  client: { uuid: string | null };
  printer: { model: string | null; firmware: string | null; uuid: string | null };
  camera: { uuid: string | null; resolution: string | null };
  software: { firmware_version: string | null; firmware: string | null; last_update: string | null; uuid: string | null };
};

// userId는 인증 컨텍스트에서 가져오기
export async function saveRegistration(payload: Payload, userId: string) {
  const device_uuid = payload.client.uuid ?? ""; // MAC
  if (!device_uuid) throw new Error("device_uuid(MAC)이 없습니다.");

  // 1) clients upsert (device_uuid 기준)
  {
    const { error } = await supabase.from("clients").upsert(
      [{
        user_id: userId,
        device_uuid,
        firmware_version: payload.software.firmware_version,
        firmware: payload.software.firmware,
        last_update: payload.software.last_update ?? null,
        software_uuid: payload.software.uuid ?? null,
        status: "active",        // 필요 시
      }],
      { onConflict: "device_uuid" }
    );
    if (error) throw error;
  }

  // 2) printers upsert (printer_uuid가 있으면 그걸로, 없으면 device_uuid로 1:1 유지)
  {
    const printer_uuid = payload.printer.uuid ?? null;
    const base = {
      user_id: userId,
      device_uuid,
      model: payload.printer.model,
      firmware: payload.printer.firmware,
      status: "connected" as const,
    };

    if (printer_uuid) {
      const { error } = await supabase.from("printers").upsert(
        [{ ...base, printer_uuid }],
        { onConflict: "printer_uuid" }
      );
      if (error) throw error;
    } else {
      // 프린터 UUID가 없다면 device_uuid를 유니크 키로 사용(위에서 unique 인덱스 생성함)
      const { error } = await supabase.from("printers").upsert(
        [{ ...base, printer_uuid: null }],
        { onConflict: "device_uuid" }
      );
      if (error) throw error;
    }
  }

  // 3) cameras upsert (옵션, camera_uuid 없어도 device_uuid 기준으로 한 줄 유지)
  {
    const { error } = await supabase.from("cameras").upsert(
      [{
        user_id: userId,
        device_uuid,
        camera_uuid: payload.camera.uuid ?? null,
        resolution: payload.camera.resolution ?? null,
      }],
      { onConflict: "device_uuid" }
    );
    if (error) throw error;
  }

  return true;
}
