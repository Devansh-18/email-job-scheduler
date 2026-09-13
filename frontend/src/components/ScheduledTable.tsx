'use client';

import React from 'react';
import { Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { EmailList } from './EmailList';

type Status = 'SCHEDULED' | 'PROCESSING' | 'RESCHEDULED' | 'PENDING';

interface ScheduledEmail {
  id: string;
  recipient: string;
  subject: string;
  bodyText?: string;
  scheduledAt: string;
  status: Status;
  retryCount: number;
  sender?: { name: string; email: string };
}

interface Props {
  emails: ScheduledEmail[];
  isLoading: boolean;
}

const badge = (email: ScheduledEmail) => {
  const d = new Date(email.scheduledAt);
  const formatted = `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}`;

  switch (email.status) {
    case 'SCHEDULED':
    case 'PENDING':
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold bg-[#fff4e5] text-[#d97706] whitespace-nowrap">
          <Clock className="w-3 h-3 mr-1" />{formatted}
        </span>
      );
    case 'PROCESSING':
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-600 whitespace-nowrap">
          <RefreshCw className="w-3 h-3 mr-1 animate-spin" />Processing
        </span>
      );
    case 'RESCHEDULED':
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 whitespace-nowrap">
          <AlertCircle className="w-3 h-3 mr-1" />Rescheduled
        </span>
      );
    default:
      return null;
  }
};

export const ScheduledTable: React.FC<Props> = ({ emails, isLoading }) => (
  <EmailList
    emails={emails}
    isLoading={isLoading}
    emptyIcon={<Clock className="w-8 h-8" />}
    emptyTitle="No Scheduled Emails"
    emptySubtitle="You don't have any pending or scheduled emails right now."
    loadingText="Loading scheduled emails..."
    renderBadge={badge}
  />
);
