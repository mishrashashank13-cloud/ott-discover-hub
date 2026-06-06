import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { Film, ArrowLeft, AlertCircle, Loader2, Mail, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { PreferencesStep } from '@/components/PreferencesStep';
import { RankingStep } from '@/components/RankingStep';
import { z } from 'zod';
import { SEO } from '@/components/SEO';

// =============================================================================
// VALIDATION SCHEMAS
// Zod schemas for validating user input before submitting to Supabase
// =============================================================================
const emailSchema = z.string().trim().email('Invalid email address').max(255, 'Email too long');
// Strong password policy: 8+ chars with upper, lower, and number.
// Enforced client-side; Supabase project should also enable matching policy in Auth settings.
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password too long')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

// =============================================================================
// AUTH COMPONENT
// Handles user authentication with email/password and Google OAuth
// =============================================================================
export const Auth = () => {
  // Form state for user inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // UI state for loading, errors, and current step
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRanking, setShowRanking] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
   
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
      
      // Determine if user has completed language and genre rankings
      const hasRankings = profile?.language_preferences && 
                         profile?.genre_preferences &&
                         Array.isArray(profile.language_preferences) &&
                         Array.isArray(profile.genre_preferences) &&
                         profile.language_preferences.length > 0 &&
                         profile.genre_preferences.length > 0;
      
      // Check if user has any content preferences saved
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
        
        // Defer Supabase calls with setTimeout to prevent deadlock
        setTimeout(async () => {
          const { hasRankings, hasPreferences } = await checkUserStatus(session.user.id);
          
          if (!hasRankings) {
            setShowRanking(true);
          } else if (!hasPreferences) {
            setShowPreferences(true);
          } else {
            navigate('/');
          }
        }, 0);
      }
    });

    // Check for existing session on component mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
        
        const { hasRankings, hasPreferences } = await checkUserStatus(session.user.id);
        
        if (!hasRankings) {
          setShowRanking(true);
        } else if (!hasPreferences) {
          setShowPreferences(true);
        } else {
          navigate('/');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // ===========================================================================
  // SIGN IN HANDLER
  // Authenticates user with email and password
  // ===========================================================================
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Validate email and password format
    const result = signInSchema.safeParse({ email, password });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Please check your inputs');
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      toast({
        title: "Welcome back!",
        description: "You have successfully signed in",
      });
    } catch (error: any) {
      // Handle specific error cases with user-friendly messages
      if (error.message.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please try again.');
      } else {
        setError(error.message ?? 'Sign in failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ===========================================================================
  // SIGN UP HANDLER
  // Creates new account with email and password
  // ===========================================================================
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Validate email and password format
    const result = signUpSchema.safeParse({ email, password });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Please check your inputs');
      setIsLoading(false);
      return;
    }

    try {
      // Sign up with email/password and use email as username
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
          data: {
            username: email.trim().split('@')[0], // Use email prefix as username
          },
        },
      });

      if (error) throw error;

      toast({
        title: "Account Created!",
        description: "Please check your email to verify your account",
      });
    } catch (error: any) {
      // Handle specific error cases with user-friendly messages
      if (error.message.includes('already registered')) {
        setError('This email is already registered. Please sign in instead.');
      } else {
        setError(error.message ?? 'Sign up failed');
      }
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
          redirectTo: `${window.location.origin}/auth`,
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
  // Show ranking or preferences screens based on user onboarding step
  // ===========================================================================
  
  // Show ranking step after successful authentication
  if (showRanking) {
    return (
      <RankingStep 
        userId={userId}
        onComplete={() => {
          setShowRanking(false);
          setShowPreferences(true);
        }}
      />
    );
  }

  // Show content preferences step after ranking
  if (showPreferences) {
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

  // ===========================================================================
  // MAIN AUTH SCREEN
  // Email/password authentication with Google as alternative
  // ===========================================================================
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <SEO
        title="Sign In to BingeGuide"
        description="Sign in or create your BingeGuide account to track OTT releases, set reminders, and get personalized movie and TV show recommendations."
        path="/auth"
      />
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
          {/* Page H1 — describes the purpose of the auth page for screen readers and SEO. */}
          <h1 className="text-2xl font-bold text-foreground">Sign In to BingeGuide</h1>
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
              {/* Email/Password login with Google alternative */}
              {/* ============================================================= */}
              <TabsContent value="signin" className="space-y-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email Address</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
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
                    disabled={isLoading}
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign In
                  </Button>
                </form>

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
              {/* Email/Password signup with Google alternative */}
              {/* ============================================================= */}
              <TabsContent value="signup" className="space-y-4">
                <form onSubmit={handleSignUp} className="space-y-4">
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
                      Your email will be used as your login
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Min 8 chars, mixed case + number"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      disabled={isLoading}
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
                    disabled={isLoading}
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Account
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
