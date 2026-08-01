'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authApi from '../lib/auth-api';

type AuthContextValue = {
  accessToken: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  setAccessToken: (token: string | null) => void;
  login: (input: { email: string; password: string; deviceName?: string }) => Promise<void>;
  refresh: () => Promise<string>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const accessTokenStorageKey = 'brand_identity_access_token';

let inFlightRefresh: Promise<string> | null = null;

function refreshAccessToken() {
  if (!inFlightRefresh) {
    inFlightRefresh = authApi
      .refresh()
      .then((response) => response.accessToken)
      .finally(() => {
        inFlightRefresh = null;
      });
  }

  return inFlightRefresh;
}

function readStoredAccessToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.sessionStorage.getItem(accessTokenStorageKey);
  } catch {
    return null;
  }
}

function storeAccessToken(token: string | null) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (token) {
      window.sessionStorage.setItem(accessTokenStorageKey, token);
    } else {
      window.sessionStorage.removeItem(accessTokenStorageKey);
    }
  } catch {
    // Storage can be unavailable in privacy modes; in-memory auth still works.
  }
}

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const updateAccessToken = useCallback((token: string | null) => {
    setAccessToken(token);
    storeAccessToken(token);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const storedAccessToken = readStoredAccessToken();

    const handleAccessTokenRefresh = (event: Event) => {
      const token = (event as CustomEvent<string>).detail;
      if (typeof token === 'string' && token.length > 0) {
        updateAccessToken(token);
      }
    };

    window.addEventListener('brand_identity_access_token_refreshed', handleAccessTokenRefresh);

    if (storedAccessToken) {
      setAccessToken(storedAccessToken);
    }

    void refreshAccessToken()
      .then((token) => {
        if (!cancelled) {
          updateAccessToken(token);
        }
      })
      .catch(() => {
        if (!cancelled && !storedAccessToken) {
          updateAccessToken(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsInitializing(false);
        }
      });

    return () => {
      cancelled = true;
      window.removeEventListener('brand_identity_access_token_refreshed', handleAccessTokenRefresh);
    };
  }, [updateAccessToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      isAuthenticated: Boolean(accessToken),
      isInitializing,
      setAccessToken: updateAccessToken,
      async login(input) {
        const response = await authApi.login(input);
        updateAccessToken(response.accessToken);
        setIsInitializing(false);
      },
      async refresh() {
        const token = await refreshAccessToken();
        updateAccessToken(token);
        setIsInitializing(false);
        return token;
      },
      async logout() {
        try {
          if (accessToken) {
            await authApi.logout(accessToken);
          }
        } finally {
          updateAccessToken(null);
          setIsInitializing(false);
        }
      }
    }),
    [accessToken, isInitializing, updateAccessToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
}
