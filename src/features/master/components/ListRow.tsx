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
    <div className="flex w-full items-center gap-2 min-w-0 w-[100%]">
      <Button
        variant={active ? "default" : "outline"}
        onClick={onSelect}
        disabled={disabled}
        className="min-w-0 flex-1 basis-0 w-auto justify-start text-left"
      >
        <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
  <span className="truncate">{title}</span>
  {meta ? (
    <span className="whitespace-nowrap text-xs opacity-80">
      {meta}
    </span>
  ) : null}
</div>

      </Button>

      {right ? (
        <div className="shrink-0 flex items-center justify-end">
          {right}
        </div>
      ) : null}
    </div>
  );
}
