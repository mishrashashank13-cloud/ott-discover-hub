import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { logger } from "@/lib/logger";
import { SEO } from "@/components/SEO";

/**
 * History Page Component
 * Displays user's browsing history of movies and TV shows
 * Allows users to view content details or clear history
 */
export const History = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  // Check authentication status
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });
  }, [navigate]);

  // Fetch browsing history
  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("browsing_history")
        .select("*")
        .order("viewed_at", { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      // Log error only in development to prevent info disclosure
      logger.error("Error fetching history:", error);
      toast({
        title: "Error",
        description: "Failed to load browsing history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Delete a single history entry
  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("browsing_history")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setHistory(history.filter((item) => item.id !== id));
      toast({
        title: "Removed",
        description: "History entry deleted",
      });
    } catch (error) {
      // Log error only in development to prevent info disclosure
      logger.error("Error deleting history:", error);
      toast({
        title: "Error",
        description: "Failed to delete history entry",
        variant: "destructive",
      });
    }
  };

  // Clear all history
  const handleClearAll = async () => {
    try {
      const { error } = await supabase
        .from("browsing_history")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

      if (error) throw error;

      setHistory([]);
      toast({
        title: "Cleared",
        description: "All browsing history has been cleared",
      });
    } catch (error) {
      // Log error only in development to prevent info disclosure
      logger.error("Error clearing history:", error);
      toast({
        title: "Error",
        description: "Failed to clear history",
        variant: "destructive",
      });
    }
  };

  // Navigate to content details page
  const handleViewDetails = (item: any) => {
    const path = item.content_type === "movie" ? `/movie/${item.content_id}` : `/tv/${item.content_id}`;
    navigate(path);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading history...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Browsing History — BingeGuide"
        description="Review the OTT movies and TV shows you've recently viewed on BingeGuide and revisit content in a single click."
        path="/history"
      />
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-6 w-6 text-primary" />
              <CardTitle>Browsing History</CardTitle>
            </div>
            {history.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearAll}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No browsing history yet</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => navigate("/")}
                >
                  Start Exploring
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent transition-colors"
                  >
                    {/* Poster Image */}
                    {item.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w92${item.poster_path}`}
                        alt={item.content_title}
                        className="w-16 h-24 object-cover rounded"
                      />
                    ) : (
                      <div className="w-16 h-24 bg-muted rounded flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">No Image</span>
                      </div>
                    )}

                    {/* Content Info */}
                    <div className="flex-1">
                      <h3 className="font-semibold">{item.content_title}</h3>
                      <p className="text-sm text-muted-foreground capitalize">
                        {item.content_type}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Viewed: {format(new Date(item.viewed_at), "PPp")}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(item)}
                      >
                        View Details
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
