import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar, Clock, TrendingUp, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { format, isToday, isThisWeek, parseISO } from "date-fns";

interface Reminder {
  id: string;
  content_id: string;
  content_title: string;
  content_type: string;
  release_date: string;
  created_at: string;
}

export const Dashboard = () => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Authentication required",
          description: "Please sign in to view your dashboard.",
          variant: "destructive",
        });
        navigate('/auth');
        return;
      }

      setUserId(session.user.id);
      await fetchReminders(session.user.id);
    };

    checkAuth();
  }, [navigate, toast]);

  const fetchReminders = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', uid)
        .order('release_date', { ascending: true });

      if (error) throw error;

      setReminders(data || []);
    } catch (error: any) {
      console.error('Error fetching reminders:', error);
      toast({
        title: "Error",
        description: "Failed to load your reminders.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleContentClick = (contentId: string, contentType: string) => {
    if (contentType === 'movie') {
      navigate(`/movie/${contentId}`);
    } else if (contentType === 'tv') {
      navigate(`/tv/${contentId}`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const todayReminders = reminders.filter(r => isToday(parseISO(r.release_date)));
  const thisWeekReminders = reminders.filter(r => 
    isThisWeek(parseISO(r.release_date), { weekStartsOn: 1 }) && !isToday(parseISO(r.release_date))
  );
  const upcomingReminders = reminders.filter(r => 
    !isToday(parseISO(r.release_date)) && !isThisWeek(parseISO(r.release_date), { weekStartsOn: 1 })
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <TrendingUp className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold text-foreground">My Dashboard</h1>
        </div>

        {reminders.length === 0 ? (
          <Alert>
            <Bell className="h-4 w-4" />
            <AlertDescription>
              You don't have any reminders set yet. Browse content and click "Remind Me" to track upcoming releases!
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-8">
            {/* Today's Releases */}
            {todayReminders.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-6 w-6 text-primary" />
                  <h2 className="text-2xl font-bold text-foreground">Releasing Today</h2>
                  <Badge variant="destructive">{todayReminders.length}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {todayReminders.map((reminder) => (
                    <Card 
                      key={reminder.id} 
                      className="cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => handleContentClick(reminder.content_id, reminder.content_type)}
                    >
                      <CardHeader>
                        <CardTitle className="text-lg flex items-start justify-between gap-2">
                          <span className="line-clamp-2">{reminder.content_title}</span>
                          <Badge variant="outline" className="shrink-0">
                            {reminder.content_type === 'movie' ? 'Movie' : 'TV Show'}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>{format(parseISO(reminder.release_date), 'MMM dd, yyyy')}</span>
                        </div>
                        <Badge className="mt-3 bg-primary/10 text-primary hover:bg-primary/20">
                          Today
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* This Week's Releases */}
            {thisWeekReminders.length > 0 && (
              <>
                {todayReminders.length > 0 && <Separator className="my-8" />}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar className="h-6 w-6 text-primary" />
                    <h2 className="text-2xl font-bold text-foreground">This Week</h2>
                    <Badge variant="secondary">{thisWeekReminders.length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {thisWeekReminders.map((reminder) => (
                      <Card 
                        key={reminder.id} 
                        className="cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => handleContentClick(reminder.content_id, reminder.content_type)}
                      >
                        <CardHeader>
                          <CardTitle className="text-lg flex items-start justify-between gap-2">
                            <span className="line-clamp-2">{reminder.content_title}</span>
                            <Badge variant="outline" className="shrink-0">
                              {reminder.content_type === 'movie' ? 'Movie' : 'TV Show'}
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>{format(parseISO(reminder.release_date), 'MMM dd, yyyy')}</span>
                          </div>
                          <Badge className="mt-3" variant="secondary">
                            This Week
                          </Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              </>
            )}

            {/* Upcoming Releases */}
            {upcomingReminders.length > 0 && (
              <>
                {(todayReminders.length > 0 || thisWeekReminders.length > 0) && (
                  <Separator className="my-8" />
                )}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Bell className="h-6 w-6 text-primary" />
                    <h2 className="text-2xl font-bold text-foreground">Coming Soon</h2>
                    <Badge variant="outline">{upcomingReminders.length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {upcomingReminders.slice(0, 12).map((reminder) => (
                      <Card 
                        key={reminder.id} 
                        className="cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => handleContentClick(reminder.content_id, reminder.content_type)}
                      >
                        <CardHeader>
                          <CardTitle className="text-sm line-clamp-2">
                            {reminder.content_title}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <Badge variant="outline" className="text-xs">
                              {reminder.content_type === 'movie' ? 'Movie' : 'TV Show'}
                            </Badge>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{format(parseISO(reminder.release_date), 'MMM dd, yyyy')}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
