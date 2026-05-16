/**
 * AboutUs.tsx - Static About Us page for BingeGuide
 * 
 * This page displays the Vision and Mission statements of BingeGuide,
 * along with key information about the platform's purpose and values.
 * Content is derived from the official Product Requirements Document (PRD).
 */

import { Target, Eye, Heart, Users, Globe, Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SEO } from "@/components/SEO";

/**
 * Main About Us page component
 * Renders Vision, Mission, and core values sections
 */
export const AboutUs = () => {
  return (
    <div className="min-h-screen bg-background pt-20 pb-12 px-4">
      <SEO
        title="About BingeGuide — Vision, Mission & What We Stand For"
        description="Learn about BingeGuide's vision and mission to help viewers discover, track, and never miss new OTT releases across all major streaming platforms."
        path="/about"
      />
      <div className="container mx-auto max-w-4xl">
        
        {/* Page Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            About BingeGuide
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Your trusted companion for discovering and tracking content across all OTT platforms
          </p>
        </div>

        {/* Vision Section - Describes the long-term goal */}
        <Card className="mb-8 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Eye className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Our Vision</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed text-lg">
              To become the go-to platform for OTT content discovery, where users never miss 
              a release they care about. We envision a world where content fragmentation across 
              multiple streaming platforms is no longer a barrier to entertainment — empowering 
              viewers to stay informed, organized, and in control of their watchlist across 
              Netflix, Amazon Prime Video, Hotstar, JioCinema, SonyLiv, Zee5, Apple TV+, and beyond.
            </p>
          </CardContent>
        </Card>

        {/* Mission Section - Describes the purpose and approach */}
        <Card className="mb-8 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Our Mission</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed text-lg">
              To provide a cross-platform discovery and reminder experience that reduces content 
              fatigue by personalizing recommendations only for content users truly care about. 
              We are building a neutral aggregator platform where users can track all releases 
              in one place and get reminders tailored to their preferences — solving the pain 
              points of missed release dates, platform-locked reminders, and promotional noise 
              from individual OTT services.
            </p>
          </CardContent>
        </Card>

        {/* The Problem We Solve Section */}
        <Card className="mb-8 border-destructive/20 bg-destructive/5">
          <CardContent className="pt-6">
            <h2 className="text-2xl font-bold text-foreground mb-4">The Problem We Solve</h2>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="text-destructive font-bold">•</span>
                <span>Users miss release dates for shows and movies they want to watch</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-destructive font-bold">•</span>
                <span>OTT platforms prioritize promoting their own content — not necessarily what users care about across platforms</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-destructive font-bold">•</span>
                <span>Reminder systems are platform-locked (e.g., Netflix reminders don't cover Prime Video)</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Core Values Grid Section */}
        <h2 className="text-2xl font-bold text-foreground mb-6 text-center">What We Stand For</h2>
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          
          {/* Value Card: User-Centric */}
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="p-4 bg-primary/10 rounded-full w-fit mx-auto mb-4">
                <Heart className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">User-Centric</h3>
              <p className="text-sm text-muted-foreground">
                Every feature is designed with your viewing preferences in mind
              </p>
            </CardContent>
          </Card>

          {/* Value Card: Platform Neutral */}
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="p-4 bg-primary/10 rounded-full w-fit mx-auto mb-4">
                <Globe className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Platform Neutral</h3>
              <p className="text-sm text-muted-foreground">
                We aggregate content from all OTT platforms without bias
              </p>
            </CardContent>
          </Card>

          {/* Value Card: Never Miss Out */}
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="p-4 bg-primary/10 rounded-full w-fit mx-auto mb-4">
                <Bell className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Never Miss Out</h3>
              <p className="text-sm text-muted-foreground">
                Timely reminders ensure you catch every premiere
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Target Audience Section */}
        <Card className="border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Who We Serve</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Primary Users</h3>
                <p className="text-sm text-muted-foreground">
                  Urban OTT enthusiasts aged 18–45, subscribed to 2–4 platforms, 
                  watching at least 3–4 shows per month.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Casual Viewers</h3>
                <p className="text-sm text-muted-foreground">
                  Users with 1–2 subscriptions who want simple reminders 
                  for their favorite shows.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Power Users</h3>
                <p className="text-sm text-muted-foreground">
                  Heavy OTT users tracking global and regional releases 
                  across multiple devices.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default AboutUs;
