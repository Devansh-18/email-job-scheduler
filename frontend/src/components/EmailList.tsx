'use client';

import React from 'react';
import { Star } from 'lucide-react';

interface EmailListProps {
  emails: any[];
  isLoading: boolean;
  emptyIcon: React.ReactNode;
  emptyTitle: string;
  emptySubtitle: string;
  loadingText: string;
  renderBadge: (email: any) => React.ReactNode;
}

/** Shared email-row list used by both ScheduledTable and SentTable */
export const EmailList: React.FC<EmailListProps> = ({
  emails,
  isLoading,
  emptyIcon,
  emptyTitle,
  emptySubtitle,
  loadingText,
  renderBadge,
}) => {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
        <p className="text-xs text-gray-400">{loadingText}</p>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4 text-center">
        <div className="p-4 rounded-full bg-gray-50 text-gray-400">{emptyIcon}</div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{emptyTitle}</h3>
          <p className="text-xs text-gray-500 mt-1">{emptySubtitle}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {emails.map((email) => {
        const snippet = email.bodyText
          ? email.bodyText.slice(0, 80) + (email.bodyText.length > 80 ? '...' : '')
          : 'No content preview available';

        return (
          <div
            key={email.id}
            className="flex items-center justify-between px-8 py-3.5 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center flex-1 min-w-0">
              {/* Recipient */}
              <div className="w-48 flex-shrink-0 pr-4">
                <span className="text-sm font-semibold text-gray-900 truncate block">
                  To: {email.recipient}
                </span>
              </div>

              {/* Status Badge */}
              <div className="w-40 flex-shrink-0 pr-4">{renderBadge(email)}</div>

              {/* Subject & Snippet */}
              <div className="flex-1 min-w-0 truncate text-sm">
                <span className="font-semibold text-gray-900 mr-2">{email.subject}</span>
                <span className="text-gray-400">- {snippet}</span>
                {email.status === 'FAILED' && email.errorMessage && (
                  <span className="ml-2 text-xs text-red-500 truncate" title={email.errorMessage}>
                    ({email.errorMessage})
                  </span>
                )}
              </div>
            </div>

            {/* Star */}
            <div className="ml-4 flex-shrink-0">
              <Star className="w-4 h-4 text-gray-300 hover:text-yellow-400 transition-colors" />
            </div>
          </div>
        );
      })}
    </div>
  );
};
