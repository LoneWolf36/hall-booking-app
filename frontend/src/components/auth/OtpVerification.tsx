/**
 * OTP Verification Component
 * 
 * 6-digit OTP input with auto-focus and validation.
 * Supports resend functionality with cooldown timer.
 */

'use client';

import { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { CheckCircleIcon, MailIcon } from 'lucide-react';

export interface OtpVerificationProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (otp: string) => void;
  onResend?: () => void;
  disabled?: boolean;
  error?: string;
  resendCooldown?: number; // seconds
  className?: string;
  autoFocus?: boolean;
}

/**
 * OTP input component with auto-focus
 */
export function OtpVerification({
  length = 6,
  value,
  onChange,
  onComplete,
  onResend,
  disabled = false,
  error,
  resendCooldown = 60,
  className,
  autoFocus = true,
}: OtpVerificationProps) {
  const [cooldownRemaining, setCooldownRemaining] = useState(resendCooldown);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown timer
  useEffect(() => {
    if (cooldownRemaining > 0) {
      const timer = setTimeout(() => {
        setCooldownRemaining(cooldownRemaining - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownRemaining]);

  // Auto-focus first input
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  // Check if OTP is complete
  useEffect(() => {
    if (value.length === length && onComplete) {
      onComplete(value);
    }
  }, [value, length, onComplete]);

  const handleChange = (index: number, digit: string) => {
    // Only allow single digit
    const newDigit = digit.replace(/\D/g, '').slice(-1);
    
    const newValue = value.split('');
    newValue[index] = newDigit;
    const updatedValue = newValue.join('').slice(0, length);
    
    onChange(updatedValue);

    // Auto-focus next input
    if (newDigit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!value[index] && index > 0) {
        // Move to previous input if current is empty
        inputRefs.current[index - 1]?.focus();
      } else {
        // Clear current input
        const newValue = value.split('');
        newValue[index] = '';
        onChange(newValue.join(''));
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const digits = pastedData.replace(/\D/g, '').slice(0, length);
    onChange(digits);
    
    // Focus last filled input
    const nextIndex = Math.min(digits.length, length - 1);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleResend = () => {
    if (onResend && cooldownRemaining === 0) {
      onResend();
      setCooldownRemaining(resendCooldown);
      onChange(''); // Clear OTP
      inputRefs.current[0]?.focus();
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="text-center space-y-2">
        <Label className="text-base">Enter Verification Code</Label>
        <p className="text-sm text-muted-foreground mt-1">
          We&apos;ve sent a 6-digit code to your phone
        </p>
      </div>

      {/* OTP Inputs */}
      <div className="flex gap-2 justify-center">
        {Array.from({ length }, (_, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={value[index] || ''}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            disabled={disabled}
            className={cn(
              'w-12 h-14 text-center text-xl font-semibold',
              'border-2 rounded-lg transition-all',
              'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
              {
                'border-destructive focus:border-destructive focus:ring-destructive/20': error,
                'border-green-500 focus:border-green-500 focus:ring-green-500/20':
                  value.length === length && !error,
                'bg-muted': disabled,
              }
            )}
            aria-label={`Digit ${index + 1} of ${length}`}
            aria-invalid={!!error}
          />
        ))}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      {/* Success message */}
      {value.length === length && !error && (
        <div className="flex items-center justify-center gap-2 text-sm text-green-600">
          <CheckCircleIcon className="h-4 w-4" />
          <span>Code verified!</span>
        </div>
      )}

      {/* Resend button */}
      {onResend && (
        <div className="text-center">
          <Button
            variant="link"
            onClick={handleResend}
            disabled={cooldownRemaining > 0 || disabled}
            className="text-sm"
          >
            {cooldownRemaining > 0 ? (
              `Resend code in ${cooldownRemaining}s`
            ) : (
              <>
                <MailIcon className="mr-2 h-4 w-4" />
                Resend Code
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * OTP status indicator
 */
export interface OtpStatusProps {
  phone: string;
  expiresIn?: number; // seconds
  className?: string;
}

export function OtpStatus({ phone, expiresIn, className }: OtpStatusProps) {
  const [timeRemaining, setTimeRemaining] = useState(expiresIn || 0);

  useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setTimeout(() => {
        setTimeRemaining(timeRemaining - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [timeRemaining]);

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  return (
    <div className={cn('text-center space-y-2', className)}>
      <p className="text-sm text-muted-foreground">
        Code sent to <span className="font-medium text-foreground">{phone}</span>
      </p>
      {expiresIn && expiresIn > 0 && (
        <p className="text-xs text-muted-foreground">
          {timeRemaining > 0 ? (
            `Expires in ${minutes}:${seconds.toString().padStart(2, '0')}`
          ) : (
            <span className="text-destructive">Code expired</span>
          )}
        </p>
      )}
    </div>
  );
}
