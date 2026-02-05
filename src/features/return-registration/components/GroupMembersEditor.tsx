"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Id, Member } from "../types";

type Props = {
  members: Member[];
  onAdd: () => void;
  onUpdate: (id: Id, patch: Partial<Member>) => void;
  onRemove: (id: Id) => void;
  error?: string;
};

export function GroupMembersEditor({ members, onAdd, onUpdate, onRemove, error }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">Anggota Rombongan</div>
          <div className="text-xs text-muted-foreground">Isi minimal 1 nama. Nomor HP opsional.</div>
        </div>
        <Button type="button" size="sm" onClick={onAdd}>
          + Tambah Anggota
        </Button>
      </div>

      {error ? <div className="text-xs text-destructive">{error}</div> : null}

      <div className="space-y-2">
        {members.map((m, idx) => (
          <div key={m.id} className="flex flex-col gap-2 rounded-md border p-3 md:flex-row md:items-center">
            <div className="text-xs text-muted-foreground w-10 shrink-0">#{idx + 1}</div>

            <Input
              value={m.name}
              onChange={(e) => onUpdate(m.id, { name: e.target.value })}
              placeholder="Nama anggota"
            />

            <Input
              value={m.phone ?? ""}
              onChange={(e) => onUpdate(m.id, { phone: e.target.value })}
              placeholder="No. HP (opsional)"
            />

            <Button
              type="button"
              variant="outline"
              onClick={() => onRemove(m.id)}
              disabled={members.length <= 1}
            >
              Hapus
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
