import { useEffect, useCallback } from 'react';
import { useAppStore } from '../stores/appStore';
import { api } from '../lib/tauri';
import { serviceLogger } from '../lib/logger';

export function useService() {
  const { serviceStatus, setServiceStatus } = useAppStore();

  const fetchStatus = useCallback(async () => {
    try {
      const status = await api.getServiceStatus();
      setServiceStatus(status);
      serviceLogger.state('Service status updated', { running: status.running, pid: status.pid });
    } catch (error) {
      serviceLogger.debug('Failed to get service status', error);
    }
  }, [setServiceStatus]);

  const start = useCallback(async () => {
    serviceLogger.action('Start service');
    serviceLogger.info('Starting service...');
    try {
      const result = await api.startService();
      serviceLogger.info('✅ Service started successfully', result);
      await fetchStatus();
      return true;
    } catch (error) {
      serviceLogger.error('❌ Failed to start service', error);
      throw error;
    }
  }, [fetchStatus]);

  const stop = useCallback(async () => {
    serviceLogger.action('Stop service');
    serviceLogger.info('Stopping service...');
    try {
      const result = await api.stopService();
      serviceLogger.info('✅ Service stopped', result);
      await fetchStatus();
      return true;
    } catch (error) {
      serviceLogger.error('❌ Failed to stop service', error);
      throw error;
    }
  }, [fetchStatus]);

  const restart = useCallback(async () => {
    serviceLogger.action('Restart service');
    serviceLogger.info('Restarting service...');
    try {
      const result = await api.restartService();
      serviceLogger.info('✅ Service restarted', result);
      await fetchStatus();
      return true;
    } catch (error) {
      serviceLogger.error('❌ Failed to restart service', error);
      throw error;
    }
  }, [fetchStatus]);

  // Auto refresh status
  useEffect(() => {
    serviceLogger.debug('Start auto refresh status');
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => {
      serviceLogger.debug('Stop auto refresh status');
      clearInterval(interval);
    };
  }, [fetchStatus]);

  return {
    status: serviceStatus,
    isRunning: serviceStatus?.running ?? false,
    fetchStatus,
    start,
    stop,
    restart,
  };
}
