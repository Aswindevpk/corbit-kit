import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { SignInForm } from "../forms/SignInForm"

export function LoginPage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm rounded-sm">
        <CardHeader className="text-center space-y-1">
          <CardTitle className="text-xl font-bold tracking-tight text-foreground">Sign in</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Enter your credentials to access the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm onSuccess={() => navigate("/", { replace: true })} />
        </CardContent>
      </Card>
    </div>
  )
}
