"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MoreVertical, Cloud, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { deleteEvent } from "@/features/event/actions/events.actions";
import { syncEventToTracker } from "@/features/event/actions/event-sync.actions";
import { EventFormDialog } from "./EventFormDialog.client";
import type { EventStatus } from "@/features/event/types";
import { logError } from "@/lib/logger-client";

export function EventRowActions({
  event,
}: {
  event: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: EventStatus;
    trackerEventId: string | null | undefined;
  };
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [synced, setSynced] = useState(!!event.trackerEventId);

  const onDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await deleteEvent({ id: event.id });
      if (!res.success) {
        toast.error(res.error || "Gagal menghapus event.");
        return;
      }
      toast.success("Event dihapus.");
      setDeleteOpen(false);
    } catch (err) {
      logError(err, { component: "EventRowActions", action: "deleteEvent", eventId: event.id });
      toast.error("Gagal menghapus event.");
    } finally {
      setIsDeleting(false);
    }
  };

  const onSyncToTracker = async () => {
    setIsSyncing(true);
    try {
      const res = await syncEventToTracker(event.id);
      if (!res.success) {
        toast.error(res.message || "Gagal sync event ke tracker API.");
        return;
      }
      toast.success("Event berhasil di-sync ke tracker API!");
      setSynced(true);
    } catch (err) {
      logError(err, { component: "EventRowActions", action: "syncEvent", eventId: event.id });
      toast.error("Gagal sync event.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Aksi"
            className="h-8 w-8"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              onSyncToTracker();
            }}
            disabled={isSyncing || synced}
          >
            {synced ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Sudah di-sync
              </>
            ) : (
              <>
                <Cloud className="mr-2 h-4 w-4" />
                {isSyncing ? "Syncing..." : "Sync ke Tracker"}
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setEditOpen(true);
            }}
          >
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onSelect={(e) => {
              e.preventDefault();
              setDeleteOpen(true);
            }}
          >
            Hapus
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EventFormDialog
        mode="edit"
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={{
          id: event.id,
          name: event.name,
          startDate: new Date(event.startDate),
          endDate: new Date(event.endDate),
          status: event.status,
        }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus event?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batalkan</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} disabled={isDeleting}>
              {isDeleting ? "Menghapus..." : "Ya, Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
