"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Props = {
  currentStep: number;
  selectedKorwilName?: string | null;
  selectedKordaName?: string | null;
  onReset: () => void;
};

export function TopBar({ currentStep, selectedKorwilName, selectedKordaName, onReset }: Props) {
  return (
      <div className="border-b mx-auto max-w-7xl px-4 py-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold">Setup Data Hierarki</div>
          <div className="text-sm text-muted-foreground">Korwil → Korda → Cakupan Kota</div>
          <div className="mt-1 text-xs text-muted-foreground">Step {currentStep}/3</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Korwil: {selectedKorwilName ?? "—"}</Badge>
          <Badge variant="secondary">Korda: {selectedKordaName ?? "—"}</Badge>
          <Button variant="outline" size="sm" onClick={onReset}>
            Reset
          </Button>
        </div>
      </div>

  );
}
