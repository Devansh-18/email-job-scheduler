'use client';

import React, { useState } from 'react';
import { useEmails } from '../../hooks/useEmails';
import { useAuth } from '../../context/AuthContext';
import { ScheduledTable } from '../../components/ScheduledTable';
import { SentTable } from '../../components/SentTable';
import { ComposeModal } from '../../components/ComposeModal';
import { Clock, Send, Search, Filter, RefreshCw, ChevronDown, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface EmailEntry {
  id: string;
  status: 'PENDING' | 'SCHEDULED' | 'PROCESSING' | 'RESCHEDULED' | 'SENT' | 'FAILED';
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');

  const {
    scheduledEmails,
    sentEmails,
    senders,
    isLoadingScheduled,
    isLoadingSent,
    refreshAll,
  } = useEmails();

  const totalScheduled = (scheduledEmails as EmailEntry[]).filter((e) => e.status === 'SCHEDULED' || e.status === 'PENDING').length;
  const totalSent = (sentEmails as EmailEntry[]).filter((e) => e.status === 'SENT').length;

  // Filter emails based on search query
  const filteredScheduled = scheduledEmails.filter((email: any) => 
    email.recipient.toLowerCase().includes(searchQuery.toLowerCase()) || 
    email.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredSent = sentEmails.filter((email: any) => 
    email.recipient.toLowerCase().includes(searchQuery.toLowerCase()) || 
    email.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <div className="flex w-full h-screen bg-white">
      {/* Sidebar */}
      <aside className="w-[260px] h-full flex flex-col border-r border-gray-100 p-4">
        {/* Logo */}
        <div className="mb-6 px-2 pt-2">
          <div className="text-3xl font-black font-mono tracking-tighter">
            ONE
          </div>
        </div>

        {/* User Profile Card */}
        <div className="relative mb-6">
          <button 
            onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
            className="w-full flex items-center justify-between bg-gray-50 hover:bg-gray-100 rounded-xl p-2 transition-colors text-left"
          >
            <div className="flex items-center space-x-3 overflow-hidden">
              <img
                src={user?.avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'}
                alt={user?.name || 'User'}
                className="h-10 w-10 rounded-full object-cover flex-shrink-0 bg-white"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="overflow-hidden">
                <p className="text-sm font-semibold text-gray-900 truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email || 'user@example.com'}</p>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mx-1" />
          </button>
          
          {/* Simple Dropdown for Logout */}
          {isProfileDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 shadow-lg rounded-xl z-50 overflow-hidden">
              <button 
                onClick={handleLogout}
                className="w-full flex items-center space-x-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>

        {/* Compose Button */}
        <button
          onClick={() => setIsComposeOpen(true)}
          className="w-full py-2.5 rounded-full border border-green-500 text-green-600 font-medium text-sm hover:bg-green-50 transition-colors mb-8"
        >
          Compose
        </button>

        {/* Navigation */}
        <div className="flex-1">
          <div className="text-[10px] font-bold text-gray-400 tracking-wider mb-3 px-3">CORE</div>
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'scheduled'
                  ? 'bg-[#e9f5ed] text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Clock className="w-4 h-4 text-gray-500" />
                <span>Scheduled</span>
              </div>
              <span className="text-xs text-gray-500">{totalScheduled}</span>
            </button>

            <button
              onClick={() => setActiveTab('sent')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'sent'
                  ? 'bg-[#e9f5ed] text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Send className="w-4 h-4 text-gray-500" />
                <span>Sent</span>
              </div>
              <span className="text-xs text-gray-500">{totalSent}</span>
            </button>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full bg-white">
        {/* Top Header */}
        <header className="h-[72px] border-b border-gray-100 flex items-center justify-between px-8 flex-shrink-0">
          <div className="flex items-center flex-1 max-w-2xl">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#f4f5f5] text-sm text-gray-900 placeholder-gray-400 rounded-full pl-10 pr-4 py-2 focus:outline-none focus:ring-1 focus:ring-gray-200"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-4 ml-6">
            <button className="text-gray-400 hover:text-gray-600 transition-colors">
              <Filter className="w-4 h-4" />
            </button>
            <button 
              onClick={refreshAll}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Refresh Queue"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'scheduled' ? (
            <ScheduledTable emails={filteredScheduled} isLoading={isLoadingScheduled} />
          ) : (
            <SentTable emails={filteredSent} isLoading={isLoadingSent} />
          )}
        </div>
      </main>

      {/* Compose Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        senders={senders}
        onSuccess={refreshAll}
      />
    </div>
  );
}
