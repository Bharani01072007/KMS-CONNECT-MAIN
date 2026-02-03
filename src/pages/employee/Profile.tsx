import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import {
  User,
  Camera,
  Loader2,
  MapPin,
  IndianRupee,
} from 'lucide-react';

/* ===================== TYPES ===================== */

interface EmployeeData {
  name: string;
  daily_wage: number;
  site_name: string | null;
  avatar_url: string | null;
}

/* ===================== COMPONENT ===================== */

const EmployeeProfile = () => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [formData, setFormData] = useState<EmployeeData>({
    name: '',
    daily_wage: 0,
    site_name: null,
    avatar_url: null,
  });

  /* ===================== FETCH ===================== */

  const fetchProfile = async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('auth_uid', user.id)
      .maybeSingle();

    const { data: employee } = await supabase
      .from('employees')
      .select('daily_wage, sites(name)')
      .eq('user_id', user.id)
      .maybeSingle();

    setFormData({
      name: profile?.full_name || '',
      avatar_url: profile?.avatar_url || null,
      daily_wage: Number(employee?.daily_wage) || 0,
      site_name: employee?.sites?.name ?? 'Not assigned',
    });

    setIsLoading(false);
  };

  /* ===================== REALTIME ===================== */

  useEffect(() => {
    if (!user) return;

    fetchProfile();

    const channel = supabase
      .channel(`employee-profile-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `auth_uid=eq.${user.id}` },
        fetchProfile
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'employees', filter: `user_id=eq.${user.id}` },
        fetchProfile
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  /* ===================== PHOTO UPLOAD ===================== */

  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'Select a valid image file',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'Image must be under 5MB',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      const ext = file.name.split('.').pop();
      const filePath = `${user.id}-${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (error) throw error;

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      await supabase
        .from('profiles')
        .update({ avatar_url: data.publicUrl })
        .eq('auth_uid', user.id);

      toast({ title: 'Photo updated' });
    } catch (e: any) {
      toast({
        title: 'Upload failed',
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  /* ===================== SAVE ===================== */

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);

    try {
      await supabase
        .from('profiles')
        .update({ full_name: formData.name || null })
        .eq('auth_uid', user.id);

      toast({ title: 'Profile saved' });
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  /* ===================== UI ===================== */

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header title="My Profile" backTo="/employee/dashboard" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header title="My Profile" backTo="/employee/dashboard" />

      <main className="p-4 max-w-lg mx-auto space-y-4">
        {/* AVATAR */}
        <Card>
          <CardContent className="p-6 text-center">
            <div className="relative inline-block">
              <Avatar className="h-24 w-24">
                <AvatarImage src={formData.avatar_url || undefined} />
                <AvatarFallback className="text-2xl">
                  {formData.name?.[0] || 'E'}
                </AvatarFallback>
              </Avatar>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-2 rounded-full"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept="image/*"
                onChange={handlePhotoUpload}
              />
            </div>

            <p className="mt-3 font-semibold text-lg">{formData.name}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </CardContent>
        </Card>

        {/* PERSONAL */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" />
              Personal Info
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Label>Name</Label>
            <Input value={formData.name} disabled/>
          </CardContent>
        </Card>

        {/* WORK */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Work Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow
              icon={<IndianRupee />}
              label="Daily Wage"
              value={`₹${formData.daily_wage}`}
            />
            <InfoRow
              icon={<MapPin />}
              label="Assigned Site"
              value={formData.site_name || 'Not assigned'}
            />
          </CardContent>
        </Card>

        <Button
          size="lg"
          className="w-full"
          disabled>
          Profile editing is disabled
        </Button>
      </main>
    </div>
  );
};

/* ===================== INFO ROW ===================== */

const InfoRow = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => (
  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
    <div className="flex items-center gap-2 text-muted-foreground">
      {icon}
      <span className="text-sm">{label}</span>
    </div>
    <span className="font-medium">{value}</span>
  </div>
);

export default EmployeeProfile;