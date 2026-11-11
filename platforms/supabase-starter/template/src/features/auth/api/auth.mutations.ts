import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/platform/client"
import { AppError } from "@/lib/contracts"
import { authKeys } from "./auth.keys"
import type { SignInValues } from "../schemas/sign-in.schema"

export function useSignIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: SignInValues) => {
      const { data, error } = await supabase.auth.signInWithPassword(values)
      if (error) throw new AppError("NOT_AUTHENTICATED", { detail: error.message })
      return data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(authKeys.session, data.session)
      queryClient.setQueryData(authKeys.user, data.user)
      queryClient.invalidateQueries({ queryKey: authKeys.session })
    },
  })
}

export function useSignOut() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw new AppError("UNKNOWN", { detail: error.message })
    },
    onSuccess: () => {
      queryClient.setQueryData(authKeys.session, null)
      queryClient.setQueryData(authKeys.user, null)
      queryClient.invalidateQueries({ queryKey: authKeys.session })
    },
  })
}
