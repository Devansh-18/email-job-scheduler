'use client';

import React from 'react';
import { Send, AlertTriangle } from 'lucide-react';
import { EmailList } from './EmailList';

type Status = 'SENT' | 'FAILED';

interface SentEmail {
  id: string;
  recipient: string;
  subject: string;
  bodyText?: string;
  sentAt?: string;
  failedAt?: string;
  status: Status;
  errorMessage?: string;
  sender?: { name: string; email: string };
}

interface Props {
  emails: SentEmail[];
  isLoading: boolean;
}

const badge = (email: SentEmail) => {
  if (email.status === 'SENT') {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500 whitespace-nowrap">
        Sent
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 whitespace-nowrap">
      <AlertTriangle className="w-3 h-3 mr-1" />Failed
    </span>
  );
};

export const SentTable: React.FC<Props> = ({ emails, isLoading }) => (
  <EmailList
    emails={emails}
    isLoading={isLoading}
    emptyIcon={<Send className="w-8 h-8" />}
    emptyTitle="No Sent Emails"
    emptySubtitle="Emails that have been dispatched or failed will appear here."
    loadingText="Loading sent history..."
    renderBadge={badge}
  />
);
