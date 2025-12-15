import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { logger } from "@/lib/logger";

/**
 * NotFound Page Component
 * Displays a 404 error page when user navigates to a non-existent route.
 * Logs the attempted route only in development mode for debugging.
 */
const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    // Log 404 errors only in development to prevent info disclosure
    logger.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-foreground">404</h1>
        <p className="text-xl text-muted-foreground mb-4">Oops! Page not found</p>
        <a href="/" className="text-primary hover:text-primary/80 underline">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
