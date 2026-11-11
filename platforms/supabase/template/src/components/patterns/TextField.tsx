import { useId, type ComponentProps } from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type TextFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  description?: string;
} & Omit<ComponentProps<typeof Input>, 'name' | 'value' | 'onChange' | 'onBlur' | 'id'>;

/** Labelled input bound to React Hook Form, with description and error text. */
export function TextField<T extends FieldValues>({ control, name, label, description, ...inputProps }: TextFieldProps<T>) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const describedBy = [description && `${id}-desc`, fieldState.error && `${id}-err`].filter(Boolean).join(' ');
        return (
          <div className="grid gap-1.5">
            <Label htmlFor={id}>{label}</Label>
            <Input
              id={id}
              {...inputProps}
              {...field}
              value={field.value ?? ''}
              disabled={inputProps.disabled || field.disabled}
              aria-invalid={!!fieldState.error}
              aria-describedby={describedBy || undefined}
            />
            {description && !fieldState.error && (
              <p id={`${id}-desc`} className="text-xs text-muted-foreground">{description}</p>
            )}
            {fieldState.error && (
              <p id={`${id}-err`} className="text-xs text-destructive">{fieldState.error.message}</p>
            )}
          </div>
        );
      }}
    />
  );
}
