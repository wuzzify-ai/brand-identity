import { render, screen, waitFor } from '@testing-library/react';
import React, { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '../src/lib/auth-api';
import { AuthProvider, useAuth } from '../src/providers/auth-provider';

vi.mock('../src/lib/auth-api', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn()
}));

function AuthProbe() {
  const auth = useAuth();

  return (
    <div>
      <span data-testid="token">{auth.accessToken ?? 'none'}</span>
      <span data-testid="initializing">{String(auth.isInitializing)}</span>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  it('restores a session once on startup even when React remounts effects in dev', async () => {
    vi.mocked(authApi.refresh).mockResolvedValue({ accessToken: 'access-token', expiresIn: 900 });

    render(
      <StrictMode>
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>
      </StrictMode>
    );

    await waitFor(() => expect(screen.getByTestId('token')).toHaveTextContent('access-token'));

    expect(screen.getByTestId('initializing')).toHaveTextContent('false');
    expect(authApi.refresh).toHaveBeenCalledTimes(1);
  });

  it('keeps the tab session available when refresh cookies are unavailable', async () => {
    window.sessionStorage.setItem('brand_identity_access_token', 'stored-access-token');
    vi.mocked(authApi.refresh).mockRejectedValue(new Error('No refresh cookie'));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('initializing')).toHaveTextContent('false'));

    expect(screen.getByTestId('token')).toHaveTextContent('stored-access-token');
    expect(authApi.refresh).toHaveBeenCalledTimes(1);
  });
});
