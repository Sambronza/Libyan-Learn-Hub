import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/hooks/use-toast';
import { Lock, ShieldOff } from 'lucide-react';

export function PasskeyModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { user, refetchUser } = useAuth();
  const api = useApi();
  const { toast } = useToast();
  
  const hasPasskey = (user as any)?.hasPasskey;
  const [currentPasskey, setCurrentPasskey] = useState('');
  const [newPasskey, setNewPasskey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSetPasskey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPasskey.length !== 4) {
      toast({ title: 'Invalid Passkey', description: 'Passkey must be exactly 4 digits.', variant: 'destructive' });
      return;
    }
    
    setIsSubmitting(true);
    try {
      await api.post('/auth/set-passkey', {
        passkey: newPasskey,
        currentPasskey: hasPasskey ? currentPasskey : undefined
      });
      toast({ title: 'Passkey set successfully!' });
      refetchUser();
      onOpenChange(false);
      setCurrentPasskey('');
      setNewPasskey('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to set passkey', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemovePasskey = async () => {
    if (!currentPasskey) {
      toast({ title: 'Required', description: 'Please enter your current passkey to remove it.', variant: 'destructive' });
      return;
    }
    
    setIsSubmitting(true);
    try {
      await api.post('/auth/remove-passkey', { currentPasskey });
      toast({ title: 'Passkey removed.' });
      refetchUser();
      onOpenChange(false);
      setCurrentPasskey('');
      setNewPasskey('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to remove passkey', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            {hasPasskey ? 'Manage Passkey' : 'Set up Passkey'}
          </DialogTitle>
          <DialogDescription>
            A passkey is a 4-digit PIN that locks your session when you are inactive or close the tab, keeping your account secure without requiring a full logout.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSetPasskey} className="space-y-4 pt-4">
          {hasPasskey && (
            <div className="grid gap-2">
              <Label>Current Passkey</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={currentPasskey}
                onChange={e => setCurrentPasskey(e.target.value.replace(/\D/g, ''))}
                className="h-12 bg-muted/50 rounded-xl"
                placeholder="Enter current PIN"
                required
              />
            </div>
          )}

          <div className="grid gap-2">
            <Label>{hasPasskey ? 'New Passkey' : 'Create Passkey (4 digits)'}</Label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={newPasskey}
              onChange={e => setNewPasskey(e.target.value.replace(/\D/g, ''))}
              className="h-12 bg-muted/50 rounded-xl"
              placeholder="Enter new PIN"
              required={!hasPasskey || !!newPasskey}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button 
              type="submit" 
              className="flex-1 h-12 rounded-xl" 
              disabled={isSubmitting || newPasskey.length !== 4}
            >
              {hasPasskey ? 'Update Passkey' : 'Save Passkey'}
            </Button>
            
            {hasPasskey && (
              <Button 
                type="button" 
                variant="destructive" 
                className="h-12 rounded-xl flex items-center gap-2"
                onClick={handleRemovePasskey}
                disabled={isSubmitting}
              >
                <ShieldOff className="w-4 h-4" /> Remove
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
