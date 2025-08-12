// services/api/base.ts
const API_BASE =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:8000/api/v1';

export class BaseApiService {
  base = API_BASE;

  async request<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
    const url = `${this.base}${endpoint}`;

    const headers = new Headers(init.headers || {});
    if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (!headers.has('Accept')) headers.set('Accept', 'application/json');

    const token = localStorage.getItem('access_token');
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const res = await fetch(url, { ...init, headers, credentials: 'include' });

    if (res.status === 204) return undefined as unknown as T;
    if (!res.ok) {
      let message = '';
      try { message = await res.text(); } catch {}
      console.error('API Error', res.status, message || res.statusText);
      throw new Error(message || `HTTP ${res.status}`);
    }

    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return (await res.text()) as unknown as T;
    return (await res.json()) as T;
  }
}
