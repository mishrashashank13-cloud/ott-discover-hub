import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, Search, Film } from "lucide-react";

export const Navigation = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Film className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold bg-hero-gradient bg-clip-text text-transparent">
              CineStream
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Button
              variant={isActive("/") ? "default" : "ghost"}
              size="sm"
              asChild
            >
              <Link to="/" className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">Home</span>
              </Link>
            </Button>

            <Button
              variant={isActive("/search") ? "default" : "ghost"}
              size="sm"
              asChild
            >
              <Link to="/search" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">Search</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};