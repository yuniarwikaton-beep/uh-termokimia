import React from 'react';
import { CheckCircle2, CloudOff, CloudUpload, AlertTriangle, Loader2 } from 'lucide-react';
import { SyncStatusType } from '../types/exam';

interface SyncStatusBadgeProps {
  status: SyncStatusType;
  pendingCount?: number;
  firebaseConfigured: boolean;
  compact?: boolean;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
  status,
  pendingCount = 0,
  firebaseConfigured,
  compact = false,
}) => {
  if (status === 'saving_firebase') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2563EB] whitespace-nowrap">
        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
        <span>MENYIMPAN KE FIREBASE</span>
      </span>
    );
  }

  if (status === 'online_synced' && firebaseConfigured) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#16A34A] whitespace-nowrap">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        <span>{compact ? 'ONLINE' : 'ONLINE — TERSINKRONISASI'}</span>
      </span>
    );
  }

  if (status === 'pending_sync') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 whitespace-nowrap">
        <CloudUpload className="h-3.5 w-3.5 shrink-0" />
        <span>
          MENUNGGU SINKRONISASI{pendingCount > 0 ? ` (${pendingCount})` : ''}
        </span>
      </span>
    );
  }

  if (status === 'sync_failed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DC2626] whitespace-nowrap">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>GAGAL SINKRONISASI</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
      <CloudOff className="h-3.5 w-3.5 shrink-0" />
      <span>
        {firebaseConfigured
          ? 'OFFLINE — TERSIMPAN DI PERANGKAT'
          : 'MODE LOKAL — TERSIMPAN DI PERANGKAT'}
      </span>
    </span>
  );
};
