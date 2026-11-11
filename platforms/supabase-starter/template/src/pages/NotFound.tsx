import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { House } from "@phosphor-icons/react"

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <Card className="rounded-sm">
        <CardContent className="p-12 text-center space-y-3.5">
          <h1 className="text-4xl font-extrabold text-foreground">404</h1>
          <h3 className="text-xl font-bold text-foreground">
            Page Not Found
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            The page you are looking for does not exist or has been moved.
          </p>
          <div className="pt-2">
            <Button
              onClick={() => navigate("/")}
              className="gap-2 rounded-sm px-6"
            >
              <House size={16} weight="bold" />
              <span>Back to Dashboard</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default NotFoundPage

