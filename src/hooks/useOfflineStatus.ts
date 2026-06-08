/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Chekify Enterprise Industrial SaaS Framework
 * Hook: useOfflineStatus
 * 
 * Exposes a reliable network interface and queue backlog counters to
 * any component, providing immediate feedback for operational personnel.
 */

import { useState, useEffect } from 'react';
import { offlineQueueService, QueueItem } from '../services/OfflineQueueService';

export interface OfflineStatus {
  isOnline: boolean;
  pendingCount: number;
  syncBacklog: QueueItem[];
  forceSync: () => void;
  clearFailed: () => void;
}

export function useOfflineStatus(): OfflineStatus {
  const [isOnline, setIsOnline] = useState<boolean>(offlineQueueService.getConnectivityStatus());
  const [syncBacklog, setSyncBacklog] = useState<QueueItem[]>(offlineQueueService.getQueueItems());

  useEffect(() => {
    // Listen for connection shifts
    const unsubscribeNetwork = offlineQueueService.subscribeToNetwork((online) => {
      setIsOnline(online);
    });

    // Listen for queue updates
    const unsubscribeQueue = offlineQueueService.subscribeToQueue((items) => {
      setSyncBacklog(items);
    });

    return () => {
      unsubscribeNetwork();
      unsubscribeQueue();
    };
  }, []);

  const pendingCount = syncBacklog.filter(i => i.state !== 'failed').length;

  return {
    isOnline,
    pendingCount,
    syncBacklog,
    forceSync: () => offlineQueueService.forceSync(),
    clearFailed: () => offlineQueueService.clearFailed()
  };
}
