import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** UI-STATE-GENERAL-ERROR / UI-STATE-BLOCKED / UI-STATE-OFFLINE-NO-DATA */
type ErrorStateProps = { title: string; description?: string; onRetry?: () => void };

export function ErrorState({ title, description, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <AlertTriangle className="size-8 text-destructive" aria-hidden />
      <div>
        <p className="font-medium">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
