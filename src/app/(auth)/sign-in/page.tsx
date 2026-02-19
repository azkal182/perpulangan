"use client";

import { useRouter } from "next/navigation";
import { signIn } from "@/client/auth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAuthForm } from "@/features/auth/components/user-auth-form";

export default function SignInPage() {
  const router = useRouter();

  void signIn; void router;

  return (
    // <main className="max-w-md h-screen flex items-center justify-center flex-col mx-auto p-6 space-y-4 text-white">
    //   <h1 className="text-2xl font-bold">Sign In</h1>

    //   {error && <p className="text-red-500">{error}</p>}

    //   <form onSubmit={handleSubmit} className="space-y-4">
    //     <Input name="email" type="email" placeholder="Email" required />
    //     <Input
    //       name="password"
    //       type="password"
    //       placeholder="Password"
    //       required
    //     />
    //     <Button type="submit">Sign In</Button>
    //   </form>
    // </main>

     <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>Sign in</CardTitle>
          <CardDescription>
            Enter your email and password below to <br />
            log into your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserAuthForm redirectTo="/dashboard" />
        </CardContent>
        <CardFooter>
          <p className='px-8 text-center text-sm text-muted-foreground'>
            By clicking sign in, you agree to our{' '}
            <a
              href='/terms'
              className='underline underline-offset-4 hover:text-primary'
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href='/privacy'
              className='underline underline-offset-4 hover:text-primary'
            >
              Privacy Policy
            </a>
            .
          </p>
        </CardFooter>
      </Card>
  );
}
