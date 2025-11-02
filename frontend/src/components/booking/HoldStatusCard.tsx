/**
 * Hold Status Card Component
 * 
 * Displays current hold status with countdown and actions
 * Used across booking flow to maintain date reservation state
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TimerIcon, AlertTriangleIcon, CheckCircleIcon, XIcon } from 'lucide-react';
import { useBookingStore } from '@/stores';
import { useAuthStore } from '@/stores/auth-store';
import { formatDateRangeCompact } from '@/lib/dates';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface HoldStatusCardProps {
  allowEdit?: boolean;
  showDetails?: boolean;
  className?: string;
}

export function HoldStatusCard({ 
  allowEdit = false, 
  showDetails = true, 
  className = '' 
}: HoldStatusCardProps) {
  const { token } = useAuthStore();
  const {
    selectedDates,
    currentHold,
    holdCountdown,
    isHoldActive,
    refreshDateHold,
    releaseDateHold,
    updateSelectedDates,
  } = useBookingStore();

  // Don't render if no dates selected
  if (selectedDates.length === 0) return null;

  const handleExtendHold = async () => {
    const success = await refreshDateHold(token);
    if (success) {
      toast.success("Date reservation extended for 30 minutes");
    } else {
      toast.error("Failed to extend reservation. Please reselect your dates.");
    }
  };

  const handleRemoveDate = async (dateToRemove: Date) => {
    if (!allowEdit) return;
    
    const newDates = selectedDates.filter(
      date => format(date, 'yyyy-MM-dd') !== format(dateToRemove, 'yyyy-MM-dd')
    );
    
    await updateSelectedDates(newDates);
    
    if (newDates.length === 0) {
      toast.info("All dates removed");
    } else {
      toast.success(`Removed ${format(dateToRemove, 'MMM d')} from selection`);
    }
  };

  const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={className}
      >
        {/* Hold Status Alert */}
        {isHoldActive && currentHold ? (
          <Alert className="border-green-200 bg-green-50 dark:border-green-800/40 dark:bg-green-900/20 mb-4">
            <CheckCircleIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-sm text-green-800 dark:text-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">Dates Reserved</span>
                  <div className="text-xs opacity-90 mt-1">
                    {holdCountdown > 0 ? `${holdCountdown} minutes remaining` : 'Expired'}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExtendHold}
                  className="text-xs h-7 px-3 border-green-300 hover:bg-green-100 dark:border-green-700 dark:hover:bg-green-900/50"
                >
                  Extend +30m
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : selectedDates.length > 0 ? (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangleIcon className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <span className="font-medium">Date reservation expired.</span>
              <div className="text-xs opacity-90 mt-1">
                Please reselect your dates to continue booking.
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        {/* Selected Dates Card */}
        {showDetails && (
          <Card className="bg-gradient-to-br from-card/60 to-card/40 backdrop-blur-sm border shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Selected Dates</CardTitle>
                <Badge variant={isHoldActive ? "default" : "destructive"}>
                  {selectedDates.length} day{selectedDates.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent>
              {/* Intelligent Range Display */}
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-sm font-medium text-primary">
                    {formatDateRangeCompact(sortedDates)}
                  </p>
                </div>
                
                {/* Individual Dates with Remove Option */}
                {allowEdit && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Individual dates:</p>
                    {sortedDates.map((date, idx) => (
                      <motion.div
                        key={format(date, 'yyyy-MM-dd')}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: idx * 0.05 }}
                        className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted/70 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircleIcon className="h-3 w-3 text-primary flex-shrink-0" />
                          <span className="text-sm font-medium">{format(date, "MMM d, yyyy")}</span>
                          <span className="text-xs text-muted-foreground">({format(date, "EEE")})</span>
                        </div>
                        
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveDate(date)}
                          className="h-6 w-6 p-0 hover:bg-destructive/20 hover:text-destructive"
                        >
                          <XIcon className="h-3 w-3" />
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                )}
                
                {/* Hold Timer Display */}
                {isHoldActive && holdCountdown > 0 && (
                  <div className="flex items-center justify-between p-2 bg-amber-50 dark:bg-amber-900/20 rounded-md border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-2">
                      <TimerIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-sm text-amber-800 dark:text-amber-200">
                        Reserved for {holdCountdown} minutes
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </AnimatePresence>
  );
}