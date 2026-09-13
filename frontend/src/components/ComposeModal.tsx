'use client';

import React, { useState } from 'react';
import {
  ArrowLeft, Paperclip, Clock, Upload,
  Undo, Redo, Type, AlignLeft,
  List, ListOrdered, Link as LinkIcon, Quote, Code, Menu,
} from 'lucide-react';
import { parseLeadFile } from '../lib/csvParser';
import { api } from '../lib/api';
import { toLocalDateTimeString } from '../lib/dateUtils';

interface Sender {
  id: string;
  name: string;
  email: string;
  maxEmailsPerHour: number;
  minDelayBetweenSends: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  senders: Sender[];
  onSuccess: () => void;
}

/** Small reusable toolbar button for the editor bar */
const ToolbarBtn: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <button
    type="button"
    className={`p-1.5 text-gray-400 hover:bg-gray-100 rounded transition-colors ${className}`}
  >
    {children}
  </button>
);

const SEND_LATER_PRESETS = [
  { label: 'Tomorrow', hour: 0 },
  { label: 'Tomorrow, 10:00 AM', hour: 10 },
  { label: 'Tomorrow, 11:00 AM', hour: 11 },
  { label: 'Tomorrow, 3:00 PM', hour: 15 },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ComposeModal: React.FC<Props> = ({ isOpen, onClose, senders, onSuccess }) => {
  const [selectedSenderId, setSelectedSenderId] = useState<string>(senders[0]?.id || '');
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [recipientsText, setRecipientsText] = useState('');
  const [recipientsList, setRecipientsList] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<string>(
    toLocalDateTimeString(new Date(Date.now() + 60000))
  );
  const [minDelay, setMinDelay] = useState('2');
  const [maxPerHour, setMaxPerHour] = useState('200');

  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  if (!isOpen) return null;

  const parseEmails = (text: string) =>
    Array.from(
      new Set(
        text
          .split(/[\s,\n]+/)
          .map((s) => s.trim().toLowerCase())
          .filter((s) => EMAIL_REGEX.test(s))
      )
    );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      setError(null);
      const result = await parseLeadFile(file);
      setRecipientsList(result.validEmails);
      setRecipientsText(result.validEmails.join(', '));
    } catch {
      setError('Failed to parse lead file. Ensure it is a valid CSV or TXT file.');
    } finally {
      setIsUploading(false);
    }
  };

  const addRecipient = (emailCandidate: string) => {
    const candidates = emailCandidate
      .split(/[\s,\n]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => EMAIL_REGEX.test(s));

    if (candidates.length > 0) {
      setRecipientsList((prev) => Array.from(new Set([...prev, ...candidates])));
      setRecipientsText('');
    }
  };

  const handleRecipientsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      addRecipient(recipientsText);
    }
  };

  const handleRecipientsBlur = () => {
    if (recipientsText.trim()) {
      addRecipient(recipientsText);
    }
  };

  const handleRecipientsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    if (text.includes(',') || text.includes(' ') || text.includes('\n')) {
      addRecipient(text);
    } else {
      setRecipientsText(text);
    }
  };

  const removeRecipient = (indexToRemove: number) => {
    setRecipientsList((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const setTomorrowTime = (hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(hour, 0, 0, 0);
    setStartTime(toLocalDateTimeString(d));
  };

  const handleSubmit = async () => {
    if (!selectedSenderId && !senders[0]?.id) return setError('No active sender found.');

    let finalRecipients = [...recipientsList];
    if (recipientsText.trim()) {
      const extra = parseEmails(recipientsText);
      finalRecipients = Array.from(new Set([...finalRecipients, ...extra]));
    }

    if (finalRecipients.length === 0) return setError('Please provide at least one valid recipient email address.');
    if (!subject.trim()) return setError('Subject is required.');
    if (!bodyText.trim()) return setError('Email body is required.');

    const scheduledDate = new Date(startTime);
    if (isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
      return setError('Start time must be in the future.');
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await api.post('/emails/schedule', {
        senderId: selectedSenderId || senders[0].id,
        recipients: finalRecipients,
        subject: subject.trim(),
        bodyText: bodyText.trim(),
        startTime: scheduledDate.toISOString(),
        minDelayBetweenSends: parseInt(minDelay, 10) || 0,
        maxEmailsPerHour: parseInt(maxPerHour, 10) || 1,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to schedule emails.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSendLater = new Date(startTime).getTime() > Date.now() + 5 * 60000;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col font-sans overflow-y-auto">
      {/* Top Bar */}
      <div className="h-[72px] border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0 bg-white sticky top-0 z-20">
        <div className="flex items-center space-x-3">
          <button onClick={onClose} className="p-2 text-gray-600 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-medium text-gray-800">Compose New Email</h2>
        </div>

        <div className="flex items-center space-x-4">
          <button type="button" className="text-gray-400 hover:text-gray-600">
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Schedule Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <Clock className="w-5 h-5" />
            </button>

            {isDatePickerOpen && (
              <div className="absolute top-full right-0 mt-3 w-72 bg-white rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-gray-100 p-5 z-50">
                <h3 className="font-semibold text-gray-900 mb-4">Send Later</h3>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full text-sm text-gray-600 border-b border-gray-200 pb-2 mb-5 focus:outline-none focus:border-green-500"
                />
                <div className="space-y-3 mb-6">
                  {SEND_LATER_PRESETS.map(({ label, hour }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setTomorrowTime(hour)}
                      className="block w-full text-left text-sm text-gray-600 hover:text-green-600 transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-center space-x-6 pt-4 border-t border-gray-50">
                  <button type="button" onClick={() => setIsDatePickerOpen(false)} className="text-sm font-semibold text-gray-800">Cancel</button>
                  <button type="button" onClick={() => setIsDatePickerOpen(false)} className="text-sm font-semibold text-green-600 border border-green-500 px-6 py-2 rounded-full hover:bg-green-50">Done</button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 rounded-full border border-green-500 text-green-600 text-sm font-medium hover:bg-green-50 transition-colors bg-white min-w-[100px] justify-center flex items-center"
          >
            {isSubmitting ? 'Sending...' : (isSendLater ? 'Send Later' : 'Send')}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto w-full pt-8 px-6 pb-20">
        {error && (
          <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
            {error}
          </div>
        )}

        <div className="space-y-6 mb-8">
          {/* From */}
          <div className="flex items-center min-h-[40px]">
            <span className="w-32 text-sm font-medium text-gray-600">From</span>
            <select
              value={selectedSenderId || senders[0]?.id || ''}
              onChange={(e) => setSelectedSenderId(e.target.value)}
              className="bg-gray-100 rounded-lg px-3 py-1.5 text-sm text-gray-700 outline-none focus:ring-1 focus:ring-gray-300 min-w-[200px]"
            >
              {senders.map((s) => <option key={s.id} value={s.id}>{s.email}</option>)}
            </select>
          </div>

          {/* To */}
          <div className="flex items-start border-b border-gray-100 pb-4 min-h-[40px]">
            <span className="w-32 text-sm font-medium text-gray-600 pt-1.5">To</span>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {recipientsList.map((email, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full border border-green-400 bg-green-50/50 text-green-700 text-xs font-medium"
                  >
                    <span>{email}</span>
                    <button
                      type="button"
                      onClick={() => removeRecipient(idx)}
                      className="ml-1 text-green-600 hover:text-green-900 focus:outline-none font-bold"
                    >
                      &times;
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={recipientsText}
                  onChange={handleRecipientsChange}
                  onKeyDown={handleRecipientsKeyDown}
                  onBlur={handleRecipientsBlur}
                  placeholder={recipientsList.length === 0 ? 'Type email address and press Enter...' : ''}
                  className="flex-1 min-w-[200px] text-sm outline-none text-gray-700 py-1"
                />
              </div>
            </div>
            <label className="cursor-pointer ml-4 flex items-center space-x-1.5 text-sm text-green-600 font-medium hover:text-green-700 pt-1.5">
              <Upload className="w-4 h-4" />
              <span>{isUploading ? 'Uploading...' : 'Upload List'}</span>
              <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          {/* Subject */}
          <div className="flex items-center border-b border-gray-100 pb-4 min-h-[40px]">
            <span className="w-32 text-sm font-medium text-gray-600">Subject</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="flex-1 text-sm text-gray-800 outline-none placeholder-gray-300"
            />
          </div>

          {/* Settings */}
          <div className="flex items-center space-x-8 pt-2">
            {[
              { label: 'Delay between 2 emails', value: minDelay, onChange: setMinDelay },
              { label: 'Hourly Limit', value: maxPerHour, onChange: setMaxPerHour },
            ].map(({ label, value, onChange }) => (
              <div key={label} className="flex items-center space-x-3">
                <span className="text-sm font-medium text-gray-800">{label}</span>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center outline-none focus:border-gray-400 text-gray-700"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Editor Area */}
        <div className="bg-[#fcfcfc] rounded-2xl overflow-hidden min-h-[400px] flex flex-col shadow-sm border border-gray-100">
          {/* Toolbar */}
          <div className="flex items-center space-x-1.5 px-4 py-3 bg-white overflow-x-auto border-b border-gray-100">
            <ToolbarBtn><Undo className="w-4 h-4" /></ToolbarBtn>
            <ToolbarBtn><Redo className="w-4 h-4" /></ToolbarBtn>

            <div className="w-px h-5 bg-gray-200 mx-2" />
            <ToolbarBtn className="flex items-center">
              <Type className="w-4 h-4 mr-1" />
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </ToolbarBtn>
            <div className="w-px h-5 bg-gray-200 mx-2" />

            <ToolbarBtn className="text-gray-500 font-bold w-8 h-8 flex items-center justify-center">B</ToolbarBtn>
            <ToolbarBtn className="text-gray-500 italic w-8 h-8 flex items-center justify-center">I</ToolbarBtn>
            <ToolbarBtn className="text-gray-500 underline w-8 h-8 flex items-center justify-center">U</ToolbarBtn>

            <div className="w-px h-5 bg-gray-200 mx-2" />
            <ToolbarBtn><Menu className="w-4 h-4" /></ToolbarBtn>
            <ToolbarBtn><AlignLeft className="w-4 h-4" /></ToolbarBtn>

            <div className="w-px h-5 bg-gray-200 mx-2" />
            <ToolbarBtn><ListOrdered className="w-4 h-4" /></ToolbarBtn>
            <ToolbarBtn><List className="w-4 h-4" /></ToolbarBtn>
            <ToolbarBtn><LinkIcon className="w-4 h-4" /></ToolbarBtn>

            <div className="w-px h-5 bg-gray-200 mx-2" />
            <ToolbarBtn><Quote className="w-4 h-4" /></ToolbarBtn>
            <ToolbarBtn><Code className="w-4 h-4" /></ToolbarBtn>
          </div>

          <textarea
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            placeholder="Type Your Reply..."
            className="flex-1 w-full p-6 text-sm text-gray-800 bg-transparent outline-none resize-none placeholder-gray-300"
          />
        </div>
      </div>
    </div>
  );
};
