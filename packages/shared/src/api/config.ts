import { httpGet, httpPost } from "./http";

export const configAPI = {
  get: () => httpGet<Record<string, any>>(`/config`),
  // 서버는 POST /config 로 업데이트
  update: (payload: Record<string, any>) => httpPost<Record<string, any>>(`/config`, payload),
};


