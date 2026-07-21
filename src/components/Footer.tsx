import { Link } from "react-router-dom";
import { Film, Info, HelpCircle, Mail, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Global site footer.
 *
 * Rendered once inside App.tsx below the main routed content. Provides:
 *  - Branding block
 *  - Quick navigation links (About, How to Use, Contact)
 *  - Prominent "Download Android App" call-to-action linking to /download
 */
export const Footer = () => {
  return (
    <footer className="mt-16 border-t border-border bg-background/60">
      <div className="container mx-auto px-4 py-10">
        <div className="grid gap-8 md:grid-cols-3">
          {/* Branding */}
          <div className="flex flex-col gap-3">
            <Link to="/" className="flex items-center gap-2">
              <Film className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold bg-hero-gradient bg-clip-text text-transparent">
                BingeGuide
              </span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs">
              Your OTT content tracker and reminder system for movies and web
              series across Indian streaming platforms.
            </p>
          </div>

          {/* Quick navigation links */}
          <nav aria-label="Footer navigation" className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              Explore
            </h2>
            <Link to="/about" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
              <Info className="h-4 w-4" /> About Us
            </Link>
            <Link to="/how-to-use" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
              <HelpCircle className="h-4 w-4" /> How to Use
            </Link>
            <Link to="/contact" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
              <Mail className="h-4 w-4" /> Contact Us
            </Link>
          </nav>

          {/* Android app download CTA */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              Get the App
            </h2>
            <p className="text-sm text-muted-foreground">
              Take BingeGuide with you — install the official Android app.
            </p>
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/download" aria-label="Download BingeGuide Android app" className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Download Android App
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border text-xs text-muted-foreground text-center">
          &copy; {new Date().getFullYear()} BingeGuide. All rights reserved.
        </div>
      </div>
    </footer>
  );
};
