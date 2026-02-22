'use client'

import * as React from 'react'
import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, LogIn } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { logError } from '@/lib/logger-client'
import { signIn } from '@/client/auth'
import {
  normalizeUsername,
  USERNAME_ALLOWED_PATTERN,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from '@/lib/username-auth'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'

const formSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, 'Please enter your username')
    .min(
      USERNAME_MIN_LENGTH,
      `Username must be at least ${USERNAME_MIN_LENGTH} characters long`,
    )
    .max(
      USERNAME_MAX_LENGTH,
      `Username must be at most ${USERNAME_MAX_LENGTH} characters long`,
    )
    .regex(
      USERNAME_ALLOWED_PATTERN,
      'Username can only contain letters, numbers, dots, and underscores',
    ),
  password: z
    .string()
    .min(1, 'Please enter your password')
    .min(7, 'Password must be at least 7 characters long'),
})

interface UserAuthFormProps extends React.HTMLAttributes<HTMLFormElement> {
  redirectTo?: string
}

export function UserAuthForm({
  className,
  redirectTo,
  ...props
}: UserAuthFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  })

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      const res = await signIn.username({
        username: normalizeUsername(data.username),
        password: data.password,
      })

      if (res?.error) {
        toast.error(res.error.message || 'Username atau password salah.')
        return
      }

      toast.success('Berhasil masuk.')
      router.push(redirectTo || '/dashboard')
      router.refresh()
    } catch (err) {
      toast.error('Gagal masuk. Coba lagi.')
      logError(err, { component: "UserAuthForm", action: "signIn" })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="john_doe" autoCapitalize="none" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem className="relative">
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder="********" {...field} />
              </FormControl>
              <FormMessage />

              <Link
                href="/forgot-password"
                className="absolute end-0 -top-0.5 text-sm font-medium text-muted-foreground hover:opacity-75"
              >
                Forgot password?
              </Link>
            </FormItem>
          )}
        />

        <Button className="mt-2" disabled={isLoading}>
          {isLoading ? <Loader2 className="animate-spin" /> : <LogIn />}
          Sign in
        </Button>
      </form>
    </Form>
  )
}
