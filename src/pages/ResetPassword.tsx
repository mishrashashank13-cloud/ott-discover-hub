import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { Film, ArrowLeft, AlertCircle, Loader2, KeyRound, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { SEO } from '@/components/SEO';

// =============================================================================
// VALIDATION SCHEMA
// =============================================================================
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password too long')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

// =============================================================================
// RESET PASSWORD PAGE
// Handles password reset via Supabase recovery token in URL hash.
// Must be a public route — no auth guard.
// =============================================================================
export const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isValidRecovery, setIsValidRecovery] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();

  // ===========================================================================
  // RECOVERY TOKEN CHECK
  // Supabase sends a recovery link with #type=recovery in the URL hash.
  // Verify that hash is present before allowing password reset.
  // ===========================================================================
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery') || hash.includes('access_token')) {
      setIsValidRecovery(true);
    } else {
      setError('Invalid or expired password reset link. Please request a new one.');
    }
  }, []);

  // ===========================================================================
  // PASSWORD UPDATE HANDLER
  // Validates new password and submits to Supabase auth.
  // ===========================================================================
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Validate password format
    const result = passwordSchema.safeParse(password);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Please check your password');
      setIsLoading(false);
      return;
    }

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setSuccess(true);
      toast({
        title: 'Password Updated',
        description: 'Your password has been reset successfully. Please sign in.',
      });
    } catch (error: any) {
      setError(error.message ?? 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <SEO
        title="Reset Password - BingeGuide"
        description="Reset your BingeGuide account password."
        path="/reset-password"
      />
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <Button variant="ghost" size="sm" asChild className="absolute top-4 left-4">
            <Link to="/auth" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Sign In
            </Link>
          </Button>

          <div className="flex items-center justify-center gap-2">
            <Film className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold bg-hero-gradient bg-clip-text text-transparent">
              BingeGuide
            </span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Reset Password</h1>
          <p className="text-muted-foreground">
            Enter your new password below
          </p>
        </div>

        <Card className="border-border bg-card">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center flex items-center justify-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              New Password
            </CardTitle>
            <CardDescription className="text-center">
              Choose a strong password for your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="text-center space-y-4 py-4">
                <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
                <p className="text-foreground font-medium">Password Reset Successful</p>
                <p className="text-muted-foreground text-sm">
                  Your password has been updated. You can now sign in with your new password.
                </p>
                <Button onClick={() => navigate('/auth')} className="w-full">
                  Go to Sign In
                </Button>
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Min 8 chars, mixed case + number"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading || !isValidRecovery}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Re-enter your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading || !isValidRecovery}
                    required
                  />
                </div>

                {error && (
                  <Alert className="border-destructive/50 bg-destructive/10">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || !isValidRecovery}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Reset Password
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
