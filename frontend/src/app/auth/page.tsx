/**
 * Authentication Page - Complete OTP Flow
 * 
 * Enhanced with:
 * - Proper backend API integration
 * - Dev OTP support (000000)
 * - Step guard integration
 * - Back navigation support
 * - Error handling with specific messages
 * - FIXED: Better contrast and visibility for light theme
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
import { useAuthStore } from '@/stores/auth-store';
import { useStepGuard, useBookingNavigation } from '@/hooks/useStepGuard';
import { toast } from 'sonner';
import { ShieldCheckIcon, UserIcon, ArrowLeft } from 'lucide-react';

type AuthStep = 'phone' | 'otp' | 'name';

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/confirmation';
  const { isValid } = useStepGuard('auth');
  const { goBack } = useBookingNavigation();
  
  const { setAuth } = useAuthStore();
  
  const [step, setStep] = useState<AuthStep>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [isPhoneValid, setIsPhoneValid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpExpiresIn, setOtpExpiresIn] = useState<number>(300);

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
      console.log('Requesting OTP for phone:', phone);
      const response = await AuthService.requestOtp(phone);
      
      if (response.success) {
        toast.success(response.message || 'OTP sent successfully');
        setOtpExpiresIn(response.expiresIn || 300);
        setStep('otp');
      } else {
        setError(response.message || 'Failed to send OTP');
        toast.error(response.message || 'Failed to send OTP');
      }
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
      toast.error('Please enter complete 6-digit OTP');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('Verifying OTP for phone:', phone, 'OTP length:', otp.length);
      const response = await AuthService.verifyOtp(phone, otp, name || undefined);
      
      if (response.success) {
        // Check if new user needs to provide name
        if (response.user?.isNewUser && !name) {
          setStep('name');
          toast.info('Welcome! Please provide your name');
          setIsLoading(false);
          return;
        }

        // Login successful
        setAuth(response);
        toast.success(`Welcome ${response.user?.name ? `back, ${response.user.name}` : ''}!`);
        
        // Redirect to original page or confirmation
        router.push(redirect);
      } else {
        setError(response.message || 'OTP verification failed');
        toast.error(response.message || 'Invalid OTP');
      }
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
    toast.info('Resending OTP...');
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

  /**
   * Go back to previous booking step
   */
  const handleBackToPrevious = () => {
    goBack();
  };

  if (!isValid) return null; // useStepGuard handles redirect

  return (
    <div className="min-h-screen flex items-center justify-center px-3 sm:px-4 py-8 sm:py-12 bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 overflow-x-hidden">
      <Card className="w-full max-w-md backdrop-blur-xl bg-white/95 dark:bg-slate-900/40 border-slate-300/50 dark:border-slate-700/30 shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-500/20 backdrop-blur-md border border-indigo-300 dark:border-indigo-400/30">
            <ShieldCheckIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <CardTitle className="text-2xl text-slate-900 dark:text-white">
            {step === 'phone' && 'Login Required'}
            {step === 'otp' && 'Verify Phone'}
            {step === 'name' && 'Complete Registration'}
          </CardTitle>
          <CardDescription className="text-slate-600 dark:text-slate-300">
            {step === 'phone' && 'Enter your phone number to continue booking'}
            {step === 'otp' && 'Enter the 6-digit code we sent you'}
            {step === 'name' && 'Tell us your name to complete setup'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Back to Booking Flow Button */}
          {step === 'phone' && (
            <Button
              onClick={handleBackToPrevious}
              variant="ghost"
              size="sm"
              className="w-full text-slate-600 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Booking
            </Button>
          )}

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
              <AlertDescription className="text-red-800 dark:text-red-200">{error}</AlertDescription>
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
              
              {/* Dev hint */}
              <div className="bg-amber-50 dark:bg-muted/50 border border-amber-200 dark:border-muted p-3 rounded-lg text-xs text-amber-800 dark:text-muted-foreground text-center">
                💡 Development: Use any 10-digit number, then enter <code className="bg-amber-100 dark:bg-muted px-1 rounded text-amber-900 dark:text-muted-foreground">000000</code> as OTP
              </div>

              <Button
                onClick={handleRequestOtp}
                disabled={!isPhoneValid || isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-primary dark:hover:bg-primary/90"
                size="lg"
              >
                {isLoading ? 'Sending...' : 'Send OTP'}
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
              
              {/* Dev hint */}
              <div className="bg-amber-50 dark:bg-muted/50 border border-amber-200 dark:border-muted p-3 rounded-lg text-xs text-amber-800 dark:text-muted-foreground text-center">
                💡 Development: Enter <code className="bg-amber-100 dark:bg-muted px-1 rounded text-amber-900 dark:text-muted-foreground">000000</code> to bypass SMS
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleBackToPhone}
                  disabled={isLoading}
                  className="flex-1 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Change Number
                </Button>
                <Button
                  onClick={handleVerifyOtp}
                  disabled={otp.length !== 6 || isLoading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-primary dark:hover:bg-primary/90"
                >
                  {isLoading ? 'Verifying...' : 'Verify'}
                </Button>
              </div>
            </>
          )}

          {/* Step 3: Name Input (New Users) */}
          {step === 'name' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-700 dark:text-slate-300">Full Name</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 dark:text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    autoFocus
                    disabled={isLoading}
                    className="pl-10 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400"
                  />
                </div>
              </div>

              <Button
                onClick={handleCompleteRegistration}
                disabled={!name.trim() || isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-primary dark:hover:bg-primary/90"
                size="lg"
              >
                {isLoading ? 'Setting up...' : 'Complete Setup'}
              </Button>
            </>
          )}

          {/* Terms */}
          <p className="text-xs text-center text-slate-600 dark:text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 dark:border-primary"></div>
      </div>
    }>
      <AuthPageContent />
    </Suspense>
  );
}