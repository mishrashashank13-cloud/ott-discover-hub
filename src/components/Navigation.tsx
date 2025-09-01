import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SearchBarCompact } from "@/components/SearchBarCompact";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Home, Search, Film, Globe } from "lucide-react";

export const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();

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
              BingeGuide
            </span>
          </Link>

          <div className="flex items-center gap-4">
            {/* Navigation Buttons */}
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

            {/* Search Bar */}
            <div className="hidden md:block w-80">
              <SearchBarCompact 
                onSearch={(query) => navigate(`/search?q=${encodeURIComponent(query)}`)}
                placeholder="Search movies, TV shows..."
                className="w-full"
              />
            </div>

            {/* Language Selector */}
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <Select defaultValue="en">
                <SelectTrigger className="w-20 border-0 bg-transparent focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">EN</SelectItem>
                  <SelectItem value="es">ES</SelectItem>
                  <SelectItem value="fr">FR</SelectItem>
                  <SelectItem value="de">DE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};