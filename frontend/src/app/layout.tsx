import React from 'react';
import { AuthProvider } from '../context/AuthContext';
import './globals.css';

export const metadata = {
  title: 'ReachInbox — Full-Stack Email Job Scheduler',
  description: 'Distributed Email Job Scheduler built with BullMQ, Redis, Nodemailer, Next.js, and Google OAuth',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-dark-bg text-gray-100 antialiased min-h-screen">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
