import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Notification {
  id: string;
  body: string | null;
  created_at: string;
}

const AnnouncementBar = () => {
  const [announcements, setAnnouncements] = useState<Notification[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  /* ===================== FETCH (DEDUPED) ===================== */

  useEffect(() => {
    const fetchAnnouncements = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, body, created_at')
        .eq('title', 'Announcement')
        .order('created_at', { ascending: false })
        .limit(20); // fetch more → dedupe later

      if (!error && data) {
        // ✅ REMOVE DUPLICATES BY BODY
        const unique = Array.from(
          new Map(data.map(a => [a.body, a])).values()
        ).slice(0, 5); // ✅ LAST 5 UNIQUE

        setAnnouncements(unique);
      }
    };

    fetchAnnouncements();
  }, []);

  /* ===================== AUTO ROTATE ===================== */

  useEffect(() => {
    if (announcements.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev =>
        prev + 1 >= announcements.length ? 0 : prev + 1
      );
    }, 5000);

    return () => clearInterval(interval);
  }, [announcements.length]);

  if (!isVisible || announcements.length === 0) return null;

  /* ===================== UI ===================== */

  return (
    <div className="bg-primary text-primary-foreground px-4 py-2.5 relative">
      <div className="flex items-center justify-center gap-2 max-w-4xl mx-auto">
        <Bell className="h-4 w-4 shrink-0 animate-pulse" />

        <p className="text-sm font-medium text-center line-clamp-1">
          {announcements[currentIndex]?.body}
        </p>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
          onClick={() => setIsVisible(false)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* DOT INDICATORS */}
      {announcements.length > 1 && (
        <div className="flex justify-center gap-1 mt-1.5">
          {announcements.map((_, i) => (
            <span
              key={i}
              className={`h-1 w-1 rounded-full ${
                i === currentIndex
                  ? 'bg-primary-foreground'
                  : 'bg-primary-foreground/40'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AnnouncementBar;