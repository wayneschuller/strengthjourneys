'use client';;
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Loader2Icon, SendIcon, SquareIcon, XIcon } from 'lucide-react';
import { Children } from 'react';

export const PromptInput = ({
  className,
  ...props
}) => (
  <form
    className={cn(
      'w-full divide-y overflow-hidden rounded-xl border bg-background shadow-sm',
      className
    )}
    {...props} />
);

export const PromptInputTextarea = ({
  onChange,
  className,
  placeholder = 'What would you like to know?',
  minHeight = 48,
  maxHeight = 164,
  ...props
}) => {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      // Don't submit if IME composition is in progress
      if (e.nativeEvent.isComposing) {
        return;
      }

      if (e.shiftKey) {
        // Allow newline
        return;
      }

      // Submit on Enter (without Shift)
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) {
        form.requestSubmit();
      }
    }
  };

  return (
    <Textarea
      className={cn(
        'w-full resize-none rounded-none border-none p-3 shadow-none outline-none ring-0',
        'field-sizing-content max-h-[6lh] bg-transparent dark:bg-transparent',
        'focus-visible:ring-0',
        className
      )}
      name="message"
      onChange={(e) => {
        onChange?.(e);
      }}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      {...props} />
  );
};

export const PromptInputToolbar = ({
  className,
  ...props
}) => (
  <div
    className={cn('flex items-center justify-between p-1', className)}
    {...props} />
);

export const PromptInputTools = ({
  className,
  ...props
}) => (
  <div
    className={cn(
      'flex items-center gap-1',
      '[&_button:first-child]:rounded-bl-xl',
      className
    )}
    {...props} />
);

export const PromptInputButton = ({
  variant = 'ghost',
  className,
  size,
  ...props
}) => {
  const newSize =
    (size ?? Children.count(props.children) > 1) ? 'default' : 'icon';

  return (
    <Button
      className={cn(
        'shrink-0 gap-1.5 rounded-lg',
        variant === 'ghost' && 'text-muted-foreground',
        newSize === 'default' && 'px-3',
        className
      )}
      size={newSize}
      type="button"
      variant={variant}
      {...props} />
  );
};

export const PromptInputSubmit = ({
  className,
  variant = 'default',
  size = 'icon',
  status,
  children,
  ...props
}) => {
  let Icon = <SendIcon className="size-4" />;

  if (status === 'submitted') {
    Icon = <Loader2Icon className="size-4 animate-spin" />;
  } else if (status === 'streaming') {
    Icon = <SquareIcon className="size-4" />;
  } else if (status === 'error') {
    Icon = <XIcon className="size-4" />;
  }

  return (
    <Button
      className={cn('gap-1.5 rounded-lg', className)}
      size={size}
      type="submit"
      variant={variant}
      {...props}>
      {children ?? Icon}
    </Button>
  );
};

export const PromptInputModelSelect = (props) => (
  <Select {...props} />
);

export const PromptInputModelSelectTrigger = ({
  className,
  ...props
}) => (
  <SelectTrigger
    className={cn(
      'border-none bg-transparent font-medium text-muted-foreground shadow-none transition-colors',
      'hover:bg-accent hover:text-foreground [&[aria-expanded="true"]]:bg-accent [&[aria-expanded="true"]]:text-foreground',
      className
    )}
    {...props} />
);

export const PromptInputModelSelectContent = ({
  className,
  ...props
}) => (
  <SelectContent className={cn(className)} {...props} />
);

export const PromptInputModelSelectItem = ({
  className,
  ...props
}) => (
  <SelectItem className={cn(className)} {...props} />
);

export const PromptInputModelSelectValue = ({
  className,
  ...props
}) => (
  <SelectValue className={cn(className)} {...props} />
);
