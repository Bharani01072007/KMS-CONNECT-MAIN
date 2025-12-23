import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import {
  MapPin,
  Plus,
  Copy,
  Building,
  QrCode,
  Download,
  Trash2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

/* ===================== TYPES ===================== */

interface Site {
  id: string;
  name: string;
  address: string | null;
  created_at: string | null;
}

/* ===================== COMPONENT ===================== */

const AdminSites = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [siteName, setSiteName] = useState('');
  const [address, setAddress] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [showQRDialog, setShowQRDialog] = useState(false);

  const qrRef = useRef<HTMLDivElement>(null);

  /* ===================== FETCH ===================== */

  useEffect(() => {
    fetchSites();
  }, []);

  const fetchSites = async () => {
    const { data, error } = await supabase
      .from('sites')
      .select('*')
      .filter('is_active', 'eq', true) // ✅ SAFE FILTER (NO TS ERROR)
      .order('name');

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    if (data) {
      setSites(
        data.map((s) => ({
          id: s.id,
          name: s.name,
          address: s.address,
          created_at: s.created_at,
        }))
      );
    }
  };

  /* ===================== CREATE ===================== */

  const handleCreate = async () => {
    if (!siteName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter site name',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const { error } = await supabase.from('sites').insert({
        name: siteName.trim(),
        address: address.trim() || null,
      });

      if (error) throw error;

      toast({ title: 'Success', description: 'Site created successfully' });
      setSiteName('');
      setAddress('');
      fetchSites();
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  /* ===================== COPY ===================== */

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', description: 'Site ID copied to clipboard' });
  };

  /* ===================== DELETE (SOFT) ===================== */

  const handleDeleteSite = async (site: Site) => {
    const ok = window.confirm(
      `Are you sure you want to delete "${site.name}"?`
    );
    if (!ok) return;

    const { error } = await supabase
      .from('sites')
      .update({ is_active: false } as any) // ✅ TS SAFE OVERRIDE
      .eq('id', site.id);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Deleted', description: 'Site removed successfully' });
    fetchSites();
  };

  /* ===================== QR ===================== */

  const openQRDialog = (site: Site) => {
    setSelectedSite(site);
    setShowQRDialog(true);
  };

  const getQRPayload = (siteId: string) =>
    JSON.stringify({ site_id: siteId });

  const downloadQR = () => {
    if (!selectedSite || !qrRef.current) return;

    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();

    const size = 300;
    canvas.width = size + 80;
    canvas.height = size + 140;

    img.onload = () => {
      if (!ctx) return;

      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 40, 40, size, size);

      ctx.fillStyle = '#000';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(selectedSite.name, canvas.width / 2, size + 100);

      const link = document.createElement('a');
      link.download = `QR-${selectedSite.name}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    img.src =
      'data:image/svg+xml;base64,' +
      btoa(unescape(encodeURIComponent(svgData)));
  };

  /* ===================== UI ===================== */

  return (
    <div className="min-h-screen bg-background">
      <Header title="Site Management" backTo="/admin/dashboard" />

      <main className="p-4 max-w-4xl mx-auto space-y-4">
        {/* CREATE */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create New Site
            </CardTitle>
            <CardDescription>
              Add a new work site for attendance tracking
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Label>Site Name *</Label>
            <Input
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
            />

            <Label>Address</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />

            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Site'}
            </Button>
          </CardContent>
        </Card>

        {/* LIST */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              All Sites ({sites.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sites.length === 0 ? (
              <p className="text-center text-muted-foreground">
                No sites created yet
              </p>
            ) : (
              sites.map((site) => (
                <div
                  key={site.id}
                  className="p-4 bg-muted/50 rounded-lg space-y-2"
                >
                  <div className="flex justify-between">
                    <div>
                      <p className="font-medium">{site.name}</p>
                      {site.address && (
                        <p className="text-sm text-muted-foreground flex gap-1">
                          <MapPin className="h-3 w-3" />
                          {site.address}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => openQRDialog(site)}
                      >
                        <QrCode className="h-4 w-4 mr-1" />
                        QR
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(site.id)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteSite(site)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground font-mono">
                    ID: {site.id}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>

      {/* QR DIALOG */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Site QR Code</DialogTitle>
            <DialogDescription>
              Print and place this QR at the site
            </DialogDescription>
          </DialogHeader>

          {selectedSite && (
            <div className="space-y-4">
              <div
                ref={qrRef}
                className="flex flex-col items-center p-4 bg-white rounded"
              >
                <QRCodeSVG
                  value={getQRPayload(selectedSite.id)}
                  size={200}
                  level="H"
                />
                <p className="mt-2 font-semibold">
                  {selectedSite.name}
                </p>
              </div>

              <Button onClick={downloadQR}>
                <Download className="h-4 w-4 mr-2" />
                Download PNG
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSites;
