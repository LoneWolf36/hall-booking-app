/**
 * Authentication Page
 * 
 * Phone-based OTP authentication flow.
 * Two-step process: request OTP → verify OTP → login complete.
 */

'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PhoneInput } from '@/components/auth/PhoneInput';
import { OtpVerification, OtpStatus } from '@/components/auth/OtpVerification';
import { AuthService } from '@/services';
import { useAuthStore } from '@/stores';
import { toast } from 'sonner';
import { ShieldCheckIcon, UserIcon } from 'lucide-react';

type AuthStep = 'phone' | 'otp' | 'name';

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  
  const { setAuth } = useAuthStore();
  
  const [step, setStep] = useState<AuthStep>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [isPhoneValid, setIsPhoneValid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpExpiresIn, setOtpExpiresIn] = useState<number>(300); // 5 minutes

  /**
   * Step 1: Request OTP
   */
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

  /**
   * Step 2: Verify OTP
   */
  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      toast.error('Please enter complete OTP');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await AuthService.verifyOtp(phone, otp, name || undefined);
      
      // Check if new user needs to provide name
      if (response.user.isNewUser && !name) {
        setStep('name');
        toast.info('Welcome! Please provide your name');
        setIsLoading(false);
        return;
      }

      // Login successful
      setAuth(response);
      toast.success(`Welcome back, ${response.user.name}!`);
      
      // Redirect to original page or home
      router.push(redirect);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Invalid OTP';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Step 3: Complete registration (new users)
   */
  const handleCompleteRegistration = async () => {
    if (!name.trim()) {
      toast.error('Please enter your name');
      return;
    }

    await handleVerifyOtp();
  };

  /**
   * Resend OTP
   */
  const handleResendOtp = async () => {
    await handleRequestOtp();
  };

  /**
   * Go back to phone input
   */
  const handleBackToPhone = () => {
    setStep('phone');
    setOtp('');
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-3 sm:px-4 py-8 sm:py-12 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-x-hidden">
      <Card className="w-full max-w-md backdrop-blur-xl bg-slate-900/40 border-slate-700/30 shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/20 backdrop-blur-md border border-indigo-400/30">
            <ShieldCheckIcon className="h-6 w-6 text-indigo-400" />
          </div>
          <CardTitle className="text-2xl">
            {step === 'phone' && 'Welcome'}
            {step === 'otp' && 'Verify Phone'}
            {step === 'name' && 'Complete Registration'}
          </CardTitle>
          <CardDescription>
            {step === 'phone' && 'Enter your phone number to get started'}
            {step === 'otp' && 'Enter the code we sent you'}
            {step === 'name' && 'Tell us your name to complete setup'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
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

              <Button
                onClick={handleRequestOtp}
                disabled={!isPhoneValid || isLoading}
                isLoading={isLoading}
                className="w-full"
                size="lg"
              >
                Continue
              </Button>
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
                  Verify
                </Button>
              </div>
            </>
          )}

          {/* Step 3: Name Input (New Users) */}
          {step === 'name' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    autoFocus
                    disabled={isLoading}
                    className="pl-10"
                  />
                </div>
              </div>

              <Button
                onClick={handleCompleteRegistration}
                disabled={!name.trim() || isLoading}
                isLoading={isLoading}
                className="w-full"
                size="lg"
              >
                Complete Setup
              </Button>
            </>
          )}

          {/* Info Text */}
          <p className="text-xs text-center text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <AuthPageContent />
    </Suspense>
  );
}
