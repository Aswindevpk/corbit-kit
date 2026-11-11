import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/platform/client"
import { authKeys } from "./auth.keys"

/** Real: Supabase Auth needs no project-specific schema, so this works out of the box. */
export function useSession() {
  return useQuery({
    queryKey: authKeys.session,
    queryFn: async () => (await supabase.auth.getSession()).data.session,
    staleTime: 1000 * 60 * 5,
  })
}

export function useCurrentUser() {
  return useQuery({
    queryKey: authKeys.user,
    queryFn: async () => (await supabase.auth.getUser()).data.user,
    staleTime: 1000 * 60 * 5,
  })
}

/** True once useSession has resolved, whichever way. Use to gate routing. */
export function useAuth() {
  const { data: session, isLoading, isError } = useSession()
  return {
    session,
    user: session?.user ?? null,
    isAuthenticated: !!session?.user,
    isLoading,
    isError,
  }
}
