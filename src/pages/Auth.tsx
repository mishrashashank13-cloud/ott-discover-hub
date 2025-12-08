import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { Film, ArrowLeft, AlertCircle, Loader2, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { PreferencesStep } from '@/components/PreferencesStep';
import { RankingStep } from '@/components/RankingStep';
import { z } from 'zod';

// =============================================================================
// VALIDATION SCHEMAS
// Zod schemas for validating user input before submitting to Supabase
// =============================================================================
const emailSchema = z.string().trim().email('Invalid email address').max(255, 'Email too long');

const signupSchema = z.object({
  username: z.string().trim().min(3, 'Username must be at least 3 characters').max(30, 'Username too long').regex(/^[a-zA-Z0-9_]+$/, 'Use letters, numbers, underscore only'),
  email: z.string().trim().email('Invalid email address').max(255, 'Email too long'),
});

// =============================================================================
// AUTH COMPONENT
// Handles user authentication with email magic link as primary, Google as alternative
// =============================================================================
export const Auth = () => {
  // Form state for user inputs
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  
  // UI state for loading, errors, and current step
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [signupStep, setSignupStep] = useState<1 | 2 | 3 | 4>(1);
  const [showRanking, setShowRanking] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  // ===========================================================================
  // AUTH STATE LISTENER
  // Monitors authentication changes and redirects users based on profile completion
  // ===========================================================================
  useEffect(() => {
    // Check if user has completed ranking and preference steps
    const checkUserStatus = async (userId: string) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('language_preferences, genre_preferences, user_id')
        .eq('user_id', userId)
        .single();
      
      const hasRankings = profile?.language_preferences && 
                         profile?.genre_preferences &&
                         Array.isArray(profile.language_preferences) &&
                         Array.isArray(profile.genre_preferences) &&
                         profile.language_preferences.length > 0 &&
                         profile.genre_preferences.length > 0;
      
      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('id')
        .eq('user_id', userId)
        .limit(1);
      
      const hasPreferences = preferences && preferences.length > 0;
      
      return { hasRankings, hasPreferences };
    };

    // Listen for auth state changes FIRST, then check existing session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        
        const { hasRankings, hasPreferences } = await checkUserStatus(session.user.id);
        
        if (!hasRankings) {
          setShowRanking(true);
          setSignupStep(3);
        } else if (!hasPreferences) {
          setShowPreferences(true);
          setSignupStep(4);
        } else {
          navigate('/');
        }
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
        
        const { hasRankings, hasPreferences } = await checkUserStatus(session.user.id);
        
        if (!hasRankings) {
          setShowRanking(true);
          setSignupStep(3);
        } else if (!hasPreferences) {
          setShowPreferences(true);
          setSignupStep(4);
        } else {
          navigate('/');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // ===========================================================================
  // EMAIL MAGIC LINK HANDLER (SIGN IN)
  // Sends a passwordless magic link to the user's email for authentication
  // ===========================================================================
  const handleSendMagicLink = async () => {
    setIsLoading(true);
    setError('');

    // Validate email format
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid email address');
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });

      if (error) throw error;

      setMagicLinkSent(true);
      toast({
        title: "Magic Link Sent",
        description: `Check your inbox at ${email} for the login link`,
      });
    } catch (error: any) {
      setError(error.message ?? 'Failed to send magic link');
    } finally {
      setIsLoading(false);
    }
  };

  // ===========================================================================
  // EMAIL MAGIC LINK SIGNUP HANDLER
  // Creates new account with username and email, sends magic link for verification
  // ===========================================================================
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const result = signupSchema.safeParse({ username, email });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Please check your inputs');
      setIsLoading(false);
      return;
    }

    try {
      // Sign up with email magic link and store username in user metadata
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
          data: {
            username,
          },
        },
      });

      if (error) throw error;

      setMagicLinkSent(true);
      setSignupStep(2);
      toast({
        title: "Magic Link Sent",
        description: `Check your inbox at ${email} to complete signup`,
      });
    } catch (error: any) {
      setError(error.message ?? 'Sign up failed');
    } finally {
      setIsLoading(false);
    }
  };

  // ===========================================================================
  // GOOGLE SOCIAL LOGIN HANDLER
  // Initiates OAuth flow with Google for authentication
  // ===========================================================================
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth?step=preferences`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      setError(error.message);
      setIsLoading(false);
    }
  };

  // ===========================================================================
  // CONDITIONAL RENDERS
  // Show ranking, preferences, or magic link confirmation screens based on step
  // ===========================================================================
  
  // Show ranking step after successful authentication
  if (showRanking || signupStep === 3) {
    return (
      <RankingStep 
        userId={userId}
        onComplete={() => {
          setShowRanking(false);
          setShowPreferences(true);
          setSignupStep(4);
        }}
      />
    );
  }

  // Show content preferences step after ranking
  if (showPreferences || signupStep === 4) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-5xl space-y-6">
          <div className="text-center">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="absolute top-4 left-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Skip to Home
            </Button>
            
            <div className="flex items-center justify-center gap-2 mb-4">
              <Film className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold bg-hero-gradient bg-clip-text text-transparent">
                BingeGuide
              </span>
            </div>
          </div>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <PreferencesStep />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show magic link sent confirmation screen
  if (magicLinkSent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <Button variant="ghost" size="sm" onClick={() => { setMagicLinkSent(false); setError(''); }} className="absolute top-4 left-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2">
              <Film className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold bg-hero-gradient bg-clip-text text-transparent">
                BingeGuide
              </span>
            </div>
          </div>

          <Card className="border-border bg-card">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl text-center">Check Your Email</CardTitle>
              <CardDescription className="text-center">
                We've sent a magic link to <strong>{email}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Email icon illustration */}
              <div className="flex justify-center py-6">
                <div className="rounded-full bg-primary/10 p-6">
                  <Mail className="h-12 w-12 text-primary" />
                </div>
              </div>

              <p className="text-center text-sm text-muted-foreground">
                Click the link in the email to sign in. The link expires in 1 hour.
              </p>

              <div className="text-center pt-4">
                <Button
                  type="button"
                  variant="link"
                  onClick={handleSendMagicLink}
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Didn't receive it? Resend magic link
                </Button>
              </div>

              <Button
                type="button"
                variant="ghost"
                onClick={() => { setMagicLinkSent(false); setEmail(''); setError(''); }}
                className="w-full"
              >
                Use a different email
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // MAIN AUTH SCREEN
  // Primary login with email magic link, Google as alternative
  // ===========================================================================
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header with logo and back navigation */}
        <div className="text-center space-y-4">
          <Button variant="ghost" size="sm" asChild className="absolute top-4 left-4">
            <Link to="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
          </Button>
          
          <div className="flex items-center justify-center gap-2">
            <Film className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold bg-hero-gradient bg-clip-text text-transparent">
              BingeGuide
            </span>
          </div>
          <p className="text-muted-foreground">
            Join the community to track your favorites and get personalized recommendations
          </p>
        </div>

        {/* Auth Forms with tabs for Sign In and Sign Up */}
        <Card className="border-border bg-card">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Welcome</CardTitle>
            <CardDescription className="text-center">
              Sign in with your email or create a new account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              {/* ============================================================= */}
              {/* SIGN IN TAB */}
              {/* Primary: Email Magic Link, Alternative: Google */}
              {/* ============================================================= */}
              <TabsContent value="signin" className="space-y-4">
                {/* Email Magic Link Login */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email Address</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                    />
                    <p className="text-xs text-muted-foreground">
                      We'll send you a magic link to sign in - no password needed
                    </p>
                  </div>
                  
                  {error && (
                    <Alert className="border-destructive/50 bg-destructive/10">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  
                  <Button 
                    onClick={handleSendMagicLink}
                    className="w-full" 
                    disabled={isLoading || !email}
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Mail className="mr-2 h-4 w-4" />
                    Send Magic Link
                  </Button>
                </div>

                {/* Separator and Google Login */}
                <div className="relative my-4">
                  <Separator />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                    Or continue with
                  </span>
                </div>

                {/* Google Login Button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="w-full"
                >
                  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </Button>
              </TabsContent>
              
              {/* ============================================================= */}
              {/* SIGN UP TAB */}
              {/* Collects username and email, sends magic link for verification */}
              {/* ============================================================= */}
              <TabsContent value="signup" className="space-y-4">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-username">Username</Label>
                    <Input
                      id="signup-username"
                      type="text"
                      placeholder="Choose a unique username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      minLength={3}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email Address</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                    <p className="text-xs text-muted-foreground">
                      We'll send you a magic link to verify your email
                    </p>
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
                    disabled={isLoading}
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Mail className="mr-2 h-4 w-4" />
                    Send Magic Link & Create Account
                  </Button>
                </form>

                <div className="relative my-4">
                  <Separator />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                    Or continue with
                  </span>
                </div>

                {/* Alternative signup with Google */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="w-full"
                >
                  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
