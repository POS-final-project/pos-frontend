import { getCookie } from "./cookies";

// Requests go to /backend/* which next.config rewrites to http://localhost:5000/*
const BASE_URL = "/backend";

function getToken(): string | null {
  return getCookie("pos_access_token");
}

function buildBody(body: unknown): BodyInit | undefined {
  if (body === undefined || body === null) return undefined;
  if (body instanceof FormData) return body;
  return JSON.stringify(body);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  const isFormData = options.body instanceof FormData;

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (isFormData) {
    headers.delete("Content-Type");
  } else if (!headers.has("Content-Type") && options.method !== "GET") {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const raw = await res.text();
  let data: unknown = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }

  if (!res.ok) {
    throw new Error(
      (typeof data === "object" && data !== null
        ? (data as { message?: string }).message
        : undefined) ?? `HTTP ${res.status}`,
    );
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: buildBody(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: buildBody(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
