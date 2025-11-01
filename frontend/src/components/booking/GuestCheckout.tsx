/**
 * Guest Checkout Component
 * 
 * Allows unauthenticated users to book via phone verification.
 * Simplified OTP flow for guest bookings.
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PhoneInput } from '@/components/auth/PhoneInput';
import { OtpVerification, OtpStatus } from '@/components/auth/OtpVerification';
import { AuthService } from '@/services';
import { toast } from 'sonner';
import { UserIcon, InfoIcon } from 'lucide-react';

interface GuestCheckoutProps {
  onComplete: (phone: string, token: string) => void;
  onCancel?: () => void;
}

type Step = 'phone' | 'otp';

export function GuestCheckout({ onComplete, onCancel }: GuestCheckoutProps) {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isPhoneValid, setIsPhoneValid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpExpiresIn, setOtpExpiresIn] = useState<number>(300);

  const handleRequestOtp = async () => {
    if (!isPhoneValid) {
      toast.error('Please enter a valid phone number');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await AuthService.requestOtp(phone);
      toast.success(response.message);
      setOtpExpiresIn(response.expiresIn);
      setStep('otp');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send OTP';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      toast.error('Please enter complete OTP');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await AuthService.verifyOtp(phone, otp);
      toast.success('Phone verified successfully!');
      
      // Pass token and phone back to parent
      onComplete(phone, response.accessToken);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Invalid OTP';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    await handleRequestOtp();
  };

  const handleBackToPhone = () => {
    setStep('phone');
    setOtp('');
    setError(null);
  };

  return (
    <Card className="bg-gradient-to-br from-card/60 to-card/40 backdrop-blur-2xl border-border/40 shadow-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserIcon className="h-5 w-5" />
          Guest Checkout
        </CardTitle>
        <CardDescription>
          Verify your phone number to continue as guest
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Info Alert */}
        <Alert className="border-primary/30 bg-primary/5">
          <InfoIcon className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm">
            We'll send you a verification code to confirm your booking. No account needed.
          </AlertDescription>
        </Alert>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Step 1: Phone Input */}
        {step === 'phone' && (
          <>
            <PhoneInput
              value={phone}
              onChange={setPhone}
              onValidChange={setIsPhoneValid}
              autoFocus
              disabled={isLoading}
            />

            <div className="flex gap-3">
              {onCancel && (
                <Button
                  variant="outline"
                  onClick={onCancel}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Cancel
                </Button>
              )}
              <Button
                onClick={handleRequestOtp}
                disabled={!isPhoneValid || isLoading}
                isLoading={isLoading}
                className="flex-1"
                size="lg"
              >
                Send OTP
              </Button>
            </div>
          </>
        )}

        {/* Step 2: OTP Verification */}
        {step === 'otp' && (
          <>
            <OtpStatus phone={phone} expiresIn={otpExpiresIn} />

            <OtpVerification
              value={otp}
              onChange={setOtp}
              onComplete={handleVerifyOtp}
              onResend={handleResendOtp}
              disabled={isLoading}
              error={error || undefined}
            />

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleBackToPhone}
                disabled={isLoading}
                className="flex-1"
              >
                Change Number
              </Button>
              <Button
                onClick={handleVerifyOtp}
                disabled={otp.length !== 6 || isLoading}
                isLoading={isLoading}
                className="flex-1"
              >
                Verify & Continue
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
