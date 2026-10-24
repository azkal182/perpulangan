"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UserAuthForm } from "@/features/auth/components/user-auth-form";

export default function SignInPage() {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-lg tracking-tight">Masuk</CardTitle>
        <CardDescription>
          Masukkan username dan password untuk masuk ke akun Anda.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <UserAuthForm redirectTo="/dashboard" />
      </CardContent>
      <CardFooter>
        <p className="px-8 text-center text-sm text-muted-foreground">
          Akses akun dikelola oleh administrator sistem.
        </p>
      </CardFooter>
    </Card>
  );
}
