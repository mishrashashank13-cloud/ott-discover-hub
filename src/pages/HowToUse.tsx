/**
 * HowToUse.tsx - Guide page explaining how to use BingeGuide
 * 
 * This page provides step-by-step instructions for new users on how to:
 * - Sign up and set preferences
 * - Discover and search content
 * - Add items to watchlist
 * - Set up reminders
 * - Manage preferences
 */

import { 
  UserPlus, 
  Search, 
  Heart, 
  Bell, 
  Settings, 
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
  Calendar,
  Tv
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";

/**
 * Represents a single step in the how-to guide
 */
interface GuideStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  details: string[];
}

/**
 * Main How to Use page component
 * Renders user flows and feature guides
 */
export const HowToUse = () => {
  const navigate = useNavigate();

  /**
   * Array of guide steps explaining core user flows
   * Each step includes an icon, title, description, and detailed points
   */
  const guideSteps: GuideStep[] = [
    {
      icon: <UserPlus className="h-8 w-8 text-primary" />,
      title: "Step 1: Sign Up",
      description: "Create your account to get started",
      details: [
        "Click on 'Login' in the navigation bar",
        "Sign up using your email address",
        "Verify your account via email",
        "Set up your profile with preferences"
      ]
    },
    {
      icon: <Search className="h-8 w-8 text-primary" />,
      title: "Step 2: Discover Content",
      description: "Browse and search for movies & shows",
      details: [
        "Use the Search feature to find specific titles",
        "Browse Trending sections on the home page",
        "Filter by genre, language, or release date",
        "Check 'Most Anticipated Releases' for upcoming content"
      ]
    },
    {
      icon: <Heart className="h-8 w-8 text-primary" />,
      title: "Step 3: Like & Dislike",
      description: "Train your preferences for better recommendations",
      details: [
        "Click the thumbs up (👍) to like content you enjoy",
        "Click the thumbs down (👎) to dislike content you don't prefer",
        "Your preferences help personalize recommendations",
        "Manage liked/disliked content in the Preferences page"
      ]
    },
    {
      icon: <Bell className="h-8 w-8 text-primary" />,
      title: "Step 4: Set Reminders",
      description: "Never miss a release date",
      details: [
        "Click 'Remind Me' on any upcoming movie or show",
        "Receive notifications when content is about to release",
        "Manage all your reminders from the Dashboard",
        "Get timely alerts so you never miss a premiere"
      ]
    },
    {
      icon: <Settings className="h-8 w-8 text-primary" />,
      title: "Step 5: Customize Preferences",
      description: "Fine-tune your experience",
      details: [
        "Go to Preferences from the user menu",
        "Select your preferred genres and languages",
        "Discover classics and rate them to improve suggestions",
        "Review and update your liked/disliked content anytime"
      ]
    }
  ];

  // Build FAQPage JSON-LD from the step guide so search engines can render the steps.
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: guideSteps.map((step) => ({
      "@type": "Question",
      name: step.title,
      acceptedAnswer: {
        "@type": "Answer",
        text: `${step.description}. ${step.details.join('. ')}.`,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-background pt-20 pb-12 px-4">
      <SEO
        title="How to Use BingeGuide — OTT Tracking Step-by-Step Guide"
        description="Step-by-step guide to BingeGuide: sign up, discover OTT content, set reminders, like or dislike titles, and personalize your watch experience."
        path="/how-to-use"
        jsonLd={faqJsonLd}
      />
      <div className="container mx-auto max-w-4xl">
        
        {/* Page Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            How to Use BingeGuide
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Your complete guide to discovering, tracking, and never missing your favorite OTT content
          </p>
        </div>

        {/* Quick Start Section */}
        <Card className="mb-8 border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tv className="h-6 w-6 text-primary" />
              Quick Start
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              BingeGuide helps you track upcoming movies and web series across all major OTT platforms 
              like Netflix, Amazon Prime Video, Hotstar, JioCinema, SonyLiv, Zee5, and more — all in one place!
            </p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => navigate("/search")} variant="default">
                <Search className="mr-2 h-4 w-4" />
                Start Searching
              </Button>
              <Button onClick={() => navigate("/auth")} variant="outline">
                <UserPlus className="mr-2 h-4 w-4" />
                Create Account
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Step-by-Step Guide */}
        <div className="space-y-6 mb-12">
          {guideSteps.map((step, index) => (
            <Card key={index} className="overflow-hidden">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-6">
                  
                  {/* Step Icon and Title */}
                  <div className="flex-shrink-0">
                    <div className="p-4 bg-primary/10 rounded-full w-fit">
                      {step.icon}
                    </div>
                  </div>
                  
                  {/* Step Details */}
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-foreground mb-2">
                      {step.title}
                    </h2>
                    <p className="text-muted-foreground mb-4">
                      {step.description}
                    </p>
                    <ul className="space-y-2">
                      {step.details.map((detail, detailIndex) => (
                        <li key={detailIndex} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <ArrowRight className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Key Features Section */}
        <h2 className="text-2xl font-bold text-foreground mb-6 text-center">Key Features</h2>
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          
          {/* Feature: Personalized Recommendations */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <ThumbsUp className="h-6 w-6 text-green-500" />
                <ThumbsDown className="h-6 w-6 text-red-500" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Personalized Recommendations</h3>
              <p className="text-sm text-muted-foreground">
                Like and dislike content to train our AI. The more you interact, 
                the better your recommendations become.
              </p>
            </CardContent>
          </Card>

          {/* Feature: Cross-Platform Tracking */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <Tv className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Cross-Platform Tracking</h3>
              <p className="text-sm text-muted-foreground">
                Track content from Netflix, Prime Video, Hotstar, JioCinema, SonyLiv, 
                Zee5, Apple TV+, and more — all in one place.
              </p>
            </CardContent>
          </Card>

          {/* Feature: Smart Reminders */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <Bell className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Smart Reminders</h3>
              <p className="text-sm text-muted-foreground">
                Set reminders for upcoming releases and get notified when your 
                favorite shows or movies are about to drop.
              </p>
            </CardContent>
          </Card>

          {/* Feature: Browsing History */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Browsing History</h3>
              <p className="text-sm text-muted-foreground">
                Access your browsing history to revisit content you've explored. 
                Never lose track of something interesting you saw.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Call to Action */}
        <Card className="text-center border-primary/30 bg-primary/5">
          <CardContent className="pt-8 pb-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-muted-foreground mb-6">
              Join BingeGuide today and never miss another release!
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button onClick={() => navigate("/auth")} size="lg">
                Sign Up Now
              </Button>
              <Button onClick={() => navigate("/")} variant="outline" size="lg">
                Explore Home
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default HowToUse;
