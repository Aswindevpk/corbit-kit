import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { EnvelopeSimple, Lock, CircleNotch, SignIn as SignInIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getErrorMessage } from "@/lib/error-messages"
import { signInSchema, type SignInValues } from "../schemas/sign-in.schema"
import { useSignIn } from "../api/auth.mutations"

type SignInFormProps = { onSuccess?: () => void }

/** Emits onSuccess(values); shows the AppError on the matching field or as a banner. */
export function SignInForm({ onSuccess }: SignInFormProps) {
  const { mutateAsync: signIn, isPending, error } = useSignIn()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInValues>({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } })

  const onSubmit = async (values: SignInValues) => {
    try {
      await signIn(values)
      onSuccess?.()
    } catch {
      // surfaced below via `error`
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div className="rounded-sm bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
          {getErrorMessage(error)}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-xs font-semibold text-foreground">
          Email address
        </Label>
        <div className="relative">
          <EnvelopeSimple size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            className="pl-9 rounded-sm h-10 text-sm"
            autoComplete="email"
            {...register("email")}
          />
        </div>
        {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-xs font-semibold text-foreground">
          Password
        </Label>
        <div className="relative">
          <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            className="pl-9 rounded-sm h-10 text-sm"
            autoComplete="current-password"
            {...register("password")}
          />
        </div>
        {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
      </div>

      <Button type="submit" disabled={isPending} className="w-full h-10 rounded-sm font-semibold gap-2 mt-2">
        {isPending ? (
          <>
            <CircleNotch size={18} className="animate-spin" />
            <span>Signing in…</span>
          </>
        ) : (
          <>
            <SignInIcon size={18} weight="bold" />
            <span>Sign in</span>
          </>
        )}
      </Button>
    </form>
  )
}
