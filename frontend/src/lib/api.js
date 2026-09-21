import axios from 'axios';
import { supabase } from './supabase.js';

const baseURL = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api`;

export const api = axios.create({ baseURL, timeout: 60000 });

// The active org id is kept in memory + localStorage and sent on every request.
let activeOrgId = localStorage.getItem('bcx_org') || null;
export function setActiveOrg(id) {
  activeOrgId = id;
  if (id) localStorage.setItem('bcx_org', id);
  else localStorage.removeItem('bcx_org');
}
export function getActiveOrg() {
  return activeOrgId;
}

// Attach the Supabase access token + org header to every request.
api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (activeOrgId) config.headers['x-org-id'] = activeOrgId;
  return config;
});

// Normalize errors into { code, message } and surface auth expiry.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const payload = error.response?.data?.error;
    const normalized = {
      code: payload?.code || 'NETWORK_ERROR',
      message: payload?.message || 'Unable to reach the server. Check your connection.',
      status: error.response?.status,
      details: payload?.details,
    };
    return Promise.reject(normalized);
  },
);

// Thin helpers returning the unwrapped `data`.
export const apiGet = (url, params) => api.get(url, { params }).then((r) => r.data.data);
export const apiGetRaw = (url, params) => api.get(url, { params }).then((r) => r.data);
export const apiPost = (url, body) => api.post(url, body).then((r) => r.data.data);
export const apiPatch = (url, body) => api.patch(url, body).then((r) => r.data.data);
export const apiDelete = (url) => api.delete(url).then((r) => r.data.data);
