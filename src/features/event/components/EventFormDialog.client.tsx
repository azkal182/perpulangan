"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { createEvent, updateEvent } from "@/features/event/actions/events.actions";
import type { EventStatus } from "@/features/event/types";

type EventFormValues = {
  id?: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: EventStatus;
};

const statusOptions: Array<{ value: EventStatus; label: string }> = [
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "COMPLETED", label: "Selesai" },
];

function toDateInputValue(value?: Date) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function EventFormDialog({
  mode,
  trigger,
  open,
  onOpenChange,
  initial,
}: {
  mode: "create" | "edit";
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initial?: {
    id?: string;
    name?: string;
    startDate?: Date;
    endDate?: Date;
    status?: EventStatus;
  };
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof open === "boolean" && !!onOpenChange;

  const dialogOpen = isControlled ? (open as boolean) : internalOpen;
  const setDialogOpen = isControlled ? onOpenChange! : setInternalOpen;

  const defaultValues = useMemo<EventFormValues>(
    () => ({
      id: initial?.id,
      name: initial?.name ?? "",
      startDate: toDateInputValue(initial?.startDate),
      endDate: toDateInputValue(initial?.endDate),
      status: initial?.status ?? "DRAFT",
    }),
    [initial],
  );

  const [name, setName] = useState(defaultValues.name);
  const [startDate, setStartDate] = useState(defaultValues.startDate);
  const [endDate, setEndDate] = useState(defaultValues.endDate);
  const [status, setStatus] = useState<EventStatus>(defaultValues.status);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!dialogOpen) return;
    setName(defaultValues.name);
    setStartDate(defaultValues.startDate);
    setEndDate(defaultValues.endDate);
    setStatus(defaultValues.status);
  }, [dialogOpen, defaultValues]);

  const title = mode === "create" ? "Tambah Event" : "Edit Event";
  const description =
    mode === "create"
      ? "Lengkapi data event perpulangan."
      : "Perbarui informasi event.";

  const submitLabel = mode === "create" ? "Simpan" : "Perbarui";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload: EventFormValues = {
      id: defaultValues.id,
      name: name.trim(),
      startDate,
      endDate,
      status,
    };

    try {
      const result =
        mode === "create"
          ? await createEvent({
              name: payload.name,
              startDate: payload.startDate,
              endDate: payload.endDate,
              status: payload.status,
            })
          : await updateEvent({
              id: payload.id!,
              name: payload.name,
              startDate: payload.startDate,
              endDate: payload.endDate,
              status: payload.status,
            });

      if (!result.success) {
        toast.error(result.error || "Gagal menyimpan event.");
        return;
      }

      toast.success("Event tersimpan.");
      setDialogOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Gagal menyimpan event.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form className="grid gap-3" onSubmit={onSubmit}>
          <div className="grid gap-1">
            <label className="text-sm font-medium" htmlFor="event-name">
              Nama Event
            </label>
            <Input
              id="event-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Liburan Ramadhan 2026"
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <label className="text-sm font-medium" htmlFor="event-start">
                Tanggal Mulai
              </label>
              <Input
                id="event-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium" htmlFor="event-end">
                Tanggal Selesai
              </label>
              <Input
                id="event-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium" htmlFor="event-status">
              Status
            </label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as EventStatus)}
            >
              <SelectTrigger id="event-status">
                <SelectValue placeholder="Pilih status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Menyimpan..." : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
