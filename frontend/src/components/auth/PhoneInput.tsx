/**
 * Phone Input Component
 * 
 * Specialized input for phone number collection with validation.
 * Supports country code selection and real-time formatting.
 */

'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { PhoneIcon } from 'lucide-react';
import { AuthService } from '@/services/auth.service';

export interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidChange?: (isValid: boolean) => void;
  countryCode?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
  autoFocus?: boolean;
}

/**
 * Phone number input with validation
 */
export function PhoneInput({
  value,
  onChange,
  onValidChange,
  countryCode = '+91',
  disabled = false,
  error,
  className,
  autoFocus = false,
}: PhoneInputProps) {
  const [isValid, setIsValid] = useState(false);
  const [touched, setTouched] = useState(false);
  const [validationError, setValidationError] = useState<string>();

  // Validate on value change
  useEffect(() => {
    let isValidPhone = false;
    let errorMsg: string | undefined;

    if (value) {
      const validation = AuthService.validatePhone(value, countryCode);
      isValidPhone = validation.isValid;
      errorMsg = validation.error;
    }

    setIsValid(isValidPhone);
    setValidationError(errorMsg);
    onValidChange?.(isValidPhone);
  }, [value, countryCode, onValidChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // Only allow digits
    const cleaned = inputValue.replace(/\D/g, '');
    onChange(cleaned);
  };

  const handleBlur = () => {
    setTouched(true);
  };

  const showError = touched && !isValid && value.length > 0;
  const displayError = error || (showError ? 'Invalid phone number' : undefined);

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor="phone-input">Phone Number</Label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 text-sm text-muted-foreground">
          <PhoneIcon className="h-4 w-4" />
          <span className="font-medium">{countryCode}</span>
          <span className="text-border">|</span>
        </div>
        <Input
          id="phone-input"
          type="tel"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="98765 43210"
          disabled={disabled}
          autoFocus={autoFocus}
          maxLength={10}
          className={cn(
            'pl-24',
            {
              'border-destructive focus-visible:ring-destructive': displayError,
              'border-green-500 focus-visible:ring-green-500': isValid && touched,
            }
          )}
          aria-invalid={!!displayError}
          aria-describedby={displayError ? 'phone-error' : undefined}
        />
      </div>
      {displayError && (
        <p id="phone-error" className="text-sm text-destructive">
          {displayError}
        </p>
      )}
      {isValid && touched && (
        <p className="text-sm text-green-600">
          ✓ Valid phone number
        </p>
      )}
    </div>
  );
}

/**
 * Compact phone display (read-only)
 */
export interface PhoneDisplayProps {
  phone: string;
  countryCode?: string;
  className?: string;
}

export function PhoneDisplay({
  phone,
  countryCode = '+91',
  className,
}: PhoneDisplayProps) {
  const formatted = AuthService.formatPhoneNumber(phone, countryCode);

  return (
    <div className={cn('flex items-center gap-2 text-sm', className)}>
      <PhoneIcon className="h-4 w-4 text-muted-foreground" />
      <span className="font-medium">{formatted}</span>
    </div>
  );
}
