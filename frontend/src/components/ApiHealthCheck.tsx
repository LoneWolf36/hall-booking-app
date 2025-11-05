"use client";

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { checkApiHealth } from '@/lib/api/client';

interface HealthStatus {
  healthy: boolean;
  message: string;
  latency?: number;
  lastChecked?: Date;
}

interface ApiHealthCheckProps {
  autoCheck?: boolean;
  interval?: number;
  onStatusChange?: (status: HealthStatus) => void;
  className?: string;
}

export function ApiHealthCheck({ 
  autoCheck = true, 
  interval = 30000, 
  onStatusChange,
  className 
}: ApiHealthCheckProps) {
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const performHealthCheck = async () => {
    if (isChecking) return;
    
    setIsChecking(true);
    try {
      const result = await checkApiHealth();
      const newStatus: HealthStatus = {
        ...result,
        lastChecked: new Date()
      };
      
      setStatus(newStatus);
      onStatusChange?.(newStatus);
    } catch (error) {
      const errorStatus: HealthStatus = {
        healthy: false,
        message: error instanceof Error ? error.message : 'Health check failed',
        lastChecked: new Date()
      };
      
      setStatus(errorStatus);
      onStatusChange?.(errorStatus);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (autoCheck) {
      // Initial check
      performHealthCheck();
      
      // Set up interval
      const intervalId = setInterval(performHealthCheck, interval);
      
      return () => clearInterval(intervalId);
    }
  }, [autoCheck, interval]);

  if (!status && !isChecking) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">API Status</CardTitle>
            <CardDescription>Backend connectivity check</CardDescription>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={performHealthCheck}
            disabled={isChecking}
            className="ml-2"
          >
            {isChecking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {isChecking ? 'Checking...' : 'Check'}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            {isChecking ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                <Badge variant="secondary">Checking...</Badge>
              </>
            ) : status?.healthy ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  Healthy
                </Badge>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-red-500" />
                <Badge variant="destructive">Unhealthy</Badge>
              </>
            )}
            
            {status?.latency && (
              <Badge variant="outline" className="text-xs">
                {status.latency}ms
              </Badge>
            )}
          </div>

          {/* Status Message */}
          <div className="text-sm text-muted-foreground">
            {status?.message}
          </div>

          {/* Last Checked */}
          {status?.lastChecked && (
            <div className="text-xs text-muted-foreground">
              Last checked: {status.lastChecked.toLocaleTimeString()}
            </div>
          )}

          {/* Troubleshooting Help */}
          {!status?.healthy && !isChecking && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Troubleshooting:</p>
                <ul className="mt-1 text-xs space-y-1">
                  <li>• Ensure backend server is running on port 3000</li>
                  <li>• Check if CORS is properly configured</li>
                  <li>• Verify environment variables are correct</li>
                  <li>• Check browser console for detailed errors</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Minimal status indicator for headers/footers
 */
export function ApiStatusIndicator({ className }: { className?: string }) {
  const [status, setStatus] = useState<HealthStatus | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const result = await checkApiHealth();
        setStatus({ ...result, lastChecked: new Date() });
      } catch (error) {
        setStatus({
          healthy: false,
          message: 'Connection failed',
          lastChecked: new Date()
        });
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, []);

  if (!status) return null;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {status.healthy ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : (
        <AlertCircle className="h-4 w-4 text-red-500" />
      )}
      <span className="text-xs text-muted-foreground">
        {status.healthy ? 'Online' : 'Offline'}
      </span>
      {status.latency && (
        <span className="text-xs text-muted-foreground">({status.latency}ms)</span>
      )}
    </div>
  );
}