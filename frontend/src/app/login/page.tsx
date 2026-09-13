'use client';

import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      setLoading(true);
      setError(null);

      const res = await api.post('/auth/google', {
        credential: credentialResponse.credential,
      });

      login(res.data.token, res.data.user);
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Login Failed:', err);
      setError(err?.response?.data?.error || 'Failed to authenticate with Google');
    } finally {
      setLoading(false);
    }
  };

  // Demo fallback login
  const handleDemoLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      const res = await api.post('/auth/google', {
        credential: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImRlbW9AcmVhY2hpbmJveC5haSIsIm5hbWUiOiJEZW1vIEFyY2hpdGVjdCIsInBpY3R1cmUiOiJodHRwczovL2FwaS5kaWNlYmVhci5jb20vNy54L2F2YXRhYWFycy9zdmc_c2VlZD1yZWFjaGluYm94In0.signature`,
      });

      login(res.data.token, res.data.user);
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Demo Login Failed:', err);
      setError('Demo login failed. Make sure backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white items-center justify-center p-4 font-sans">
      <div className="w-full max-w-[400px] bg-white rounded-xl border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-10">
        <h1 className="text-[32px] font-bold text-center text-gray-900 tracking-tight mb-8">Login</h1>
        
        {error && (
          <div className="mb-6 p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg text-center">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Custom Google Button Wrapper */}
          <div className="relative w-full h-11 bg-[#eaf3ed] hover:bg-[#dcece2] rounded-lg cursor-pointer transition-colors flex items-center justify-center overflow-hidden group">
            {/* Real Google Auth overlay (invisible but clickable) */}
            <div className="absolute inset-0 z-10 opacity-0 flex justify-center items-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google OAuth verification failed')}
                width="400"
                size="large"
              />
            </div>
            
            {/* Visual Custom Button */}
            <div className="flex items-center space-x-3 pointer-events-none">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span className="text-sm font-medium text-gray-700">Login with Google</span>
            </div>
          </div>

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-gray-100"></div>
            <span className="flex-shrink-0 mx-4 text-xs text-gray-400">or sign up through email</span>
            <div className="flex-grow border-t border-gray-100"></div>
          </div>

          <form onSubmit={handleDemoLogin} className="space-y-4">
            <div>
              <input 
                type="text" // using text to avoid auto-validating for dummy login
                placeholder="Email ID"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#f4f5f5] text-gray-800 placeholder-gray-400 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 border-none"
              />
            </div>
            <div>
              <input 
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#f4f5f5] text-gray-800 placeholder-gray-400 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 border-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00a651] hover:bg-[#009649] text-white font-medium py-3 rounded-lg text-sm transition-colors mt-2"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
