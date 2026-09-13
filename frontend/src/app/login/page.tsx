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
          {/* Official Google OAuth Button */}
          <div className="flex justify-center w-full py-1">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() =>
                setError(
                  'Google Auth failed. Make sure your Vercel URL is added to Authorized JavaScript Origins in Google Cloud Console.'
                )
              }
              size="large"
              width="320"
              text="continue_with"
              shape="rectangular"
            />
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
