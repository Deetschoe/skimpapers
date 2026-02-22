// Skim API Client
// Handles all communication with the backend API

const BASE_URL = '/api';

const TOKEN_KEY = 'skim_token';
const USER_KEY = 'skim_user';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface Paper {
  id: string;
  userId: string;
  title: string;
  authors: string[];
  abstract: string;
  url: string;
  pdfUrl: string;
  markdownContent?: string;
  summary: string;
  rating: number;
  category: string;
  tags: string[];
  source: string;
  publishedDate: string;
  addedDate: string;
  isRead: boolean;
}

export interface Collection {
  id: string;
  name: string;
  icon: string;
  colorName: string;
  paperCount: number;
  createdAt: string;
}

export interface Annotation {
  id: string;
  paperId: string;
  selectedText: string | null;
  note: string | null;
  aiResponse: string | null;
  pageNumber: number | null;
  createdAt: string;
}

export interface UsageInfo {
  totalPapers: number;
  totalQueries: number;
  apiCostEstimate: number;
  monthlyCost: number;
  periodStart: string;
  periodEnd: string;
}

// ── Token & User Management ─────────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getUser(): User | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setUser(user: User): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// ── Request Helper ──────────────────────────────────────────────────────────

async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    const isAuthEndpoint = path.startsWith('/auth/');
    if (!isAuthEndpoint) {
      clearToken();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    const errorBody = await res.json().catch(() => ({}));
    const message =
      (errorBody as { error?: string }).error || 'Unauthorized';
    throw new Error(message);
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const message =
      (errorBody as { error?: string }).error ||
      (errorBody as { message?: string }).message ||
      `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

// ── Convenience Methods ─────────────────────────────────────────────────────

export function get<T = unknown>(path: string): Promise<T> {
  return request<T>('GET', path);
}

export function post<T = unknown>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, body);
}

export function put<T = unknown>(path: string, body?: unknown): Promise<T> {
  return request<T>('PUT', path, body);
}

export function del<T = unknown>(path: string): Promise<T> {
  return request<T>('DELETE', path);
}

// ── Auth Helpers ───────────────────────────────────────────────────────────

export interface AuthResponse {
  user: User;
  token: string;
}

export function checkEmail(email: string): Promise<{ exists: boolean }> {
  return post('/auth/check-email', { email });
}

export function requestCode(email: string, accessCode?: string): Promise<{ success: boolean }> {
  return post('/auth/request-code', { email, ...(accessCode ? { accessCode } : {}) });
}

export function verifyCode(email: string, code: string): Promise<AuthResponse> {
  return post('/auth/verify-code', { email, code });
}

const API = { getToken, setToken, clearToken, getUser, setUser, get, post, put, del };
export default API;
