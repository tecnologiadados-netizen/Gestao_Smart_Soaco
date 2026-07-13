import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster as Sonner } from '@rh/components/ui/sonner';
import { Toaster } from '@rh/components/ui/toaster';
import { TooltipProvider } from '@rh/components/ui/tooltip';
import { SavingOverlayProvider } from '@rh/contexts/saving-overlay-context';
import { useAuth } from '@/contexts/AuthContext';
import { loadRhSessionPermissions } from '@rh/lib/auth';
import { rhQueryClient } from '@rh/lib/query-client';
import '@rh/rh-module.css';

export default function RhModuleRoot() {
  const { isMaster, login, profileLoaded } = useAuth();

  useEffect(() => {
    if (!profileLoaded) return;
    void loadRhSessionPermissions(isMaster, login);
  }, [isMaster, login, profileLoaded]);

  return (
    <QueryClientProvider client={rhQueryClient}>
      <SavingOverlayProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <div className="rh-module min-h-0 flex flex-1 flex-col overflow-auto">
            <Outlet />
          </div>
        </TooltipProvider>
      </SavingOverlayProvider>
    </QueryClientProvider>
  );
}
