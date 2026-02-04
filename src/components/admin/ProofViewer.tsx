import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ExternalLink, RefreshCw, FileWarning, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProofViewerProps {
  proofUrl: string;
}

export function ProofViewer({ proofUrl }: ProofViewerProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSignedUrl();
  }, [proofUrl]);

  const getSignedUrl = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Extract the path from the full URL
      // URL format: https://xxx.supabase.co/storage/v1/object/public/deposit-proofs/user-id/filename.ext
      const urlParts = proofUrl.split('/deposit-proofs/');
      if (urlParts.length < 2) {
        throw new Error('Invalid proof URL format');
      }
      
      const filePath = urlParts[1];
      
      // Create a signed URL for private bucket access (valid for 1 hour)
      const { data, error: signedUrlError } = await supabase.storage
        .from('deposit-proofs')
        .createSignedUrl(filePath, 3600);

      if (signedUrlError) throw signedUrlError;
      
      setSignedUrl(data.signedUrl);
    } catch (err) {
      console.error('Error getting signed URL:', err);
      setError(err instanceof Error ? err.message : 'Failed to load proof');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <RefreshCw className="h-8 w-8 animate-spin mb-4" />
        <p>Loading proof...</p>
      </div>
    );
  }

  if (error || !signedUrl) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileWarning className="h-12 w-12 mb-4 opacity-50 text-destructive" />
        <p className="mb-2 text-destructive">{error || 'Failed to load proof'}</p>
        <Button variant="outline" size="sm" onClick={getSignedUrl}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const isImage = proofUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  const isPdf = proofUrl.match(/\.pdf$/i);

  return (
    <div className="space-y-4">
      {isImage ? (
        <img 
          src={signedUrl} 
          alt="Transaction proof" 
          className="w-full rounded-xl border border-border"
        />
      ) : isPdf ? (
        <iframe 
          src={signedUrl} 
          title="Transaction proof PDF"
          className="w-full h-[500px] rounded-xl border border-border"
        />
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <FileWarning className="h-12 w-12 mb-4 opacity-50" />
          <p className="mb-4">Preview not available for this file type</p>
        </div>
      )}
      
      <div className="flex items-center gap-3">
        <a 
          href={signedUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <ExternalLink className="h-4 w-4" />
          Open in new tab
        </a>
        <a 
          href={signedUrl} 
          download
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <Download className="h-4 w-4" />
          Download
        </a>
      </div>
    </div>
  );
}
