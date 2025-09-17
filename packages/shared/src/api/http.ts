// packages/shared/src/api/http.ts
export type HttpError = Error & { status?: number; body?: unknown };

const BASE_URL =
  (import.meta as any)?.env?.VITE_RASP_SERVER // 배포/에뮬에서 사용
  ?? "/api";                                 // dev 프록시 기본값

console.log("BASE_URL", import.meta.env.VITE_RASP_SERVER ?? "/api");
function headers(init?: RequestInit) {
  return {
    "Content-Type": "application/json",
    "X-Trace-Id": crypto?.randomUUID?.() ?? `${Date.now()}`,
    ...(init?.headers || {}),
  };
}

async function toHttpError(res: Response): Promise<HttpError> {
  let body: any = null;
  try { body = await res.json(); } catch {}
  const err: HttpError = new Error(
    (body && (body.error || body.message)) || `HTTP ${res.status}`
  );
  err.status = res.status;
  err.body = body;
  return err;
}

export async function httpGet<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers: headers(init) });
  if (!res.ok) throw await toHttpError(res);
  return res.json() as Promise<T>;
}

export async function httpPost<T>(path: string, data?: any, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    body: data ? JSON.stringify(data) : undefined,
    ...init,
    headers: headers(init),
  });
  if (!res.ok) throw await toHttpError(res);
  return res.json() as Promise<T>;
}

export async function httpPut<T>(path: string, data?: any, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PUT",
    body: data ? JSON.stringify(data) : undefined,
    ...init,
    headers: headers(init),
  });
  if (!res.ok) throw await toHttpError(res);
  return res.json() as Promise<T>;
}

export async function httpDelete<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "DELETE",
    ...init,
    headers: headers(init),
  });
  if (!res.ok) throw await toHttpError(res);
  return res.json() as Promise<T>;
}

// 업로드는 FormData를 그대로 보냄(헤더 자동 설정)
export async function httpUpload<T>(path: string, form: FormData, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    body: form,
    ...(init || {}),
    headers: {
      "X-Trace-Id": crypto?.randomUUID?.() ?? `${Date.now()}`,
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) throw await toHttpError(res);
  return res.json() as Promise<T>;
}
