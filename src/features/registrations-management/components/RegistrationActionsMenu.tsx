"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, Eye, DollarSign, Ban, RefreshCw, Trash2 } from "lucide-react";
import type { RegistrationWithDetails } from "../repositories/registrations.repository";

interface RegistrationActionsMenuProps {
  registration: RegistrationWithDetails;
  onViewDetail: () => void;
  onUpdatePayment: () => void;
  onCancel: () => void;
  onRefund: () => void;
  onDelete: () => void;
}

export function RegistrationActionsMenu({
  registration,
  onViewDetail,
  onUpdatePayment,
  onCancel,
  onRefund,
  onDelete,
}: RegistrationActionsMenuProps) {
  const [open, setOpen] = useState(false);

  const handleAction = (action: () => void) => {
    action();
    setOpen(false);
  };

  // Check if there are any paid journeys for refund
  const hasPaidJourneys = registration.outboundPaid || registration.returnPaid;
  
  // Can only cancel if not already cancelled
  const canCancel = registration.status !== "CANCELLED";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => handleAction(onViewDetail)}>
          <Eye className="mr-2 h-4 w-4" />
          Lihat Detail
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => handleAction(onUpdatePayment)}>
          <DollarSign className="mr-2 h-4 w-4" />
          Update Pembayaran
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={() => handleAction(onCancel)}
          disabled={!canCancel}
        >
          <Ban className="mr-2 h-4 w-4" />
          {canCancel ? "Batalkan" : "Sudah Dibatalkan"}
        </DropdownMenuItem>
        
        <DropdownMenuItem
          onClick={() => handleAction(onRefund)}
          disabled={!hasPaidJourneys}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {hasPaidJourneys ? "Refund" : "Belum Ada Pembayaran"}
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={() => handleAction(onDelete)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Hapus
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
