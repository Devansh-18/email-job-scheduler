'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  isLoading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('reachinbox_token');
    const storedUser = localStorage.getItem('reachinbox_user');

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch (err) {
        localStorage.removeItem('reachinbox_token');
        localStorage.removeItem('reachinbox_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('reachinbox_token', newToken);
    localStorage.setItem('reachinbox_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('reachinbox_token');
    localStorage.removeItem('reachinbox_user');
  };

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'mock_google_client_id_for_testing';

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
        {children}
      </AuthContext.Provider>
    </GoogleOAuthProvider>
  );
};
