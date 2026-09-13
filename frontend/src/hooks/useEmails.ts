import useSWR from 'swr';
import { api } from '../lib/api';

const fetcher = (url: string) => api.get(url).then((res) => res.data);

export const useEmails = () => {
  const {
    data: scheduledData,
    error: scheduledError,
    mutate: mutateScheduled,
    isLoading: isLoadingScheduled,
  } = useSWR('/emails/scheduled', fetcher, {
    refreshInterval: 3000,
  });

  const {
    data: sentData,
    error: sentError,
    mutate: mutateSent,
    isLoading: isLoadingSent,
  } = useSWR('/emails/sent', fetcher, {
    refreshInterval: 3000,
  });

  const { data: sendersData, isLoading: isLoadingSenders } = useSWR('/emails/senders', fetcher);

  const refreshAll = () => {
    mutateScheduled();
    mutateSent();
  };

  return {
    scheduledEmails: scheduledData?.data || [],
    sentEmails: sentData?.data || [],
    senders: sendersData?.data || [],
    isLoadingScheduled,
    isLoadingSent,
    isLoadingSenders,
    scheduledError,
    sentError,
    refreshAll,
  };
};
