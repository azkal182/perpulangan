"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type Props = {
  title: string;
  description: string;
  headerRight?: React.ReactNode;
  top?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function ColumnCard({ title, description, headerRight, top, children, footer }: Props) {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {headerRight}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {top}
        <Separator />
        {children}
        {footer}
      </CardContent>
    </Card>
  );
}
