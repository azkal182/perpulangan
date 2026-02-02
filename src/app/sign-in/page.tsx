"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/client/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    const res = await signIn.email({
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    });

    if (res.error) {
      setError(res.error.message || "Something went wrong.");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <main className="max-w-md h-screen flex items-center justify-center flex-col mx-auto p-6 space-y-4 text-white">
      <h1 className="text-2xl font-bold">Sign In</h1>

      {error && <p className="text-red-500">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input name="email" type="email" placeholder="Email" required />
        <Input
          name="password"
          type="password"
          placeholder="Password"
          required
        />
        <Button type="submit">Sign In</Button>
      </form>
    </main>
  );
}
