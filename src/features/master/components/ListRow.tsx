"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

type Props = {
  active?: boolean;
  title: string;
  meta?: string;
  onSelect?: () => void;
  disabled?: boolean;
  right?: React.ReactNode;
};

export function ListRow({ active, title, meta, onSelect, disabled, right }: Props) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant={active ? "default" : "outline"}
        className="flex-1 justify-between"
        onClick={onSelect}
        disabled={disabled}
      >
        <span className="truncate">{title}</span>
        {meta ? <span className="text-xs opacity-80">{meta}</span> : null}
      </Button>

      <div className="shrink-0">{right}</div>
    </div>
  );
}
