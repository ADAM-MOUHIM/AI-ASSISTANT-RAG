// base.ts

// ---- base URL helpers (no process.env needed) ----
function normalizeBase(raw: string): string {
  let base = (raw || "").trim().replace(/\/+$/, "");
  if (!/\/api\/v1$/.test(base)) base = `${base}/api/v1`;
  return base;
}

function getApiBase(): string {
  const g: any = globalThis as any;

  // allow setting window.__API_BASE__ or window.VITE_API_URL, etc.
  const globalBase = g.__API_BASE__ || g.API_BASE || g.NEXT_PUBLIC_API_URL || g.VITE_API_URL;
  if (typeof globalBase === "string" && globalBase) return normalizeBase(globalBase);

  // Vite style (no process usage)
  try {
    const viteVal = (import.meta as any)?.env?.VITE_API_URL;
    if (viteVal) return normalizeBase(viteVal);
  } catch {}

  // derive from browser origin by default
  if (typeof window !== "undefined" && window.location?.origin) {
    return normalizeBase(window.location.origin);
  }

  // dev fallback
  return "http://localhost:8000/api/v1";
}

export class BaseApiService {
  private API: string;

  constructor() {
    this.API = getApiBase();
  }

  // ---- Overloads: keep old call sites working (returns any), but allow typed use if desired ----
  protected request<T>(path: string, opts?: RequestInit): Promise<T>;
  protected request(path: string, opts?: RequestInit): Promise<any>;

  protected async request<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
    const url = path.startsWith("/") ? `${this.API}${path}` : `${this.API}/${path}`;
    const method = (opts.method || "GET").toUpperCase();

    // headers + auth
    const headers = new Headers(opts.headers || {});
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("access_token") || sessionStorage.getItem("access_token")
        : null;
    if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);

    // only send body for non-GET/HEAD
    const canSendBody = method !== "GET" && method !== "HEAD";
    const body = canSendBody ? opts.body : undefined;
    if (canSendBody && body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

    const res = await fetch(url, {
      ...opts,
      method,
      headers,
      body,
      credentials: opts.credentials ?? "include",
    });

    if (res.status === 204) return undefined as T; // e.g., DELETE

    let data: any = undefined;
    try { data = await res.json(); } catch {}

    if (!res.ok) {
      throw new Error(JSON.stringify({
        detail: data?.detail || res.statusText,
        status: res.status,
        method,
        url,
      }));
    }
    return data as T; // old call sites accept any; typed sites can opt-in
  }
}
