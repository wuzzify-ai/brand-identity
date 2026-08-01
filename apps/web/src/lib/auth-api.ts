import { z } from 'zod';
import { apiFetch } from './api-client';

export const authTokenResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number()
});

export type AuthTokenResponse = z.infer<typeof authTokenResponseSchema>;

export const genericAuthResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string().optional()
});

export type GenericAuthResponse = z.infer<typeof genericAuthResponseSchema>;

export function register(input: {
  email: string;
  displayName: string;
  password: string;
  workspaceName: string;
  workspaceSlug: string;
}) {
  return apiFetch<GenericAuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function login(input: { email: string; password: string; deviceName?: string }) {
  return apiFetch<AuthTokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function refresh() {
  return apiFetch<AuthTokenResponse>('/auth/refresh', { method: 'POST' });
}

export function verifyEmail(token: string) {
  return apiFetch<GenericAuthResponse>('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token })
  });
}

export function forgotPassword(email: string) {
  return apiFetch<GenericAuthResponse>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
}

export function resetPassword(input: { token: string; newPassword: string }) {
  return apiFetch<GenericAuthResponse>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function logout(accessToken: string) {
  return apiFetch<GenericAuthResponse>('/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` }
  });
}

export function logoutAll(accessToken: string) {
  return apiFetch<GenericAuthResponse>('/auth/logout-all', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` }
  });
}
