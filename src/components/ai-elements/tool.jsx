'use client';;
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  CheckCircleIcon,
  ChevronDownIcon,
  CircleIcon,
  ClockIcon,
  WrenchIcon,
  XCircleIcon,
} from 'lucide-react';
import { CodeBlock } from './code-block';

export const Tool = ({
  className,
  ...props
}) => (
  <Collapsible
    className={cn('not-prose mb-4 w-full rounded-md border', className)}
    {...props} />
);

const getStatusBadge = (status) => {
  const labels = {
    'input-streaming': 'Pending',
    'input-available': 'Running',
    'output-available': 'Completed',
    'output-error': 'Error'
  };

  const icons = {
    'input-streaming': <CircleIcon className="size-4" />,
    'input-available': <ClockIcon className="size-4 animate-pulse" />,
    'output-available': <CheckCircleIcon className="size-4 text-green-600" />,
    'output-error': <XCircleIcon className="size-4 text-red-600" />
  };

  return (
    <Badge className="rounded-full text-xs" variant="secondary">
      {icons[status]}
      {labels[status]}
    </Badge>
  );
};

export const ToolHeader = ({
  className,
  type,
  state,
  ...props
}) => (
  <CollapsibleTrigger
    className={cn('flex w-full items-center justify-between gap-4 p-3', className)}
    {...props}>
    <div className="flex items-center gap-2">
      <WrenchIcon className="size-4 text-muted-foreground" />
      <span className="font-medium text-sm">{type}</span>
      {getStatusBadge(state)}
    </div>
    <ChevronDownIcon
      className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
  </CollapsibleTrigger>
);

export const ToolContent = ({
  className,
  ...props
}) => (
  <CollapsibleContent
    className={cn(
      'data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in',
      className
    )}
    {...props} />
);

export const ToolInput = ({
  className,
  input,
  ...props
}) => (
  <div className={cn('space-y-2 overflow-hidden p-4', className)} {...props}>
    <h4
      className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
      Parameters
    </h4>
    <div className="rounded-md bg-muted/50">
      <CodeBlock code={JSON.stringify(input, null, 2)} language="json" />
    </div>
  </div>
);

export const ToolOutput = ({
  className,
  output,
  errorText,
  ...props
}) => {
  if (!(output || errorText)) {
    return null;
  }

  return (
    <div className={cn('space-y-2 p-4', className)} {...props}>
      <h4
        className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {errorText ? 'Error' : 'Result'}
      </h4>
      <div
        className={cn('overflow-x-auto rounded-md text-xs [&_table]:w-full', errorText
          ? 'bg-destructive/10 text-destructive'
          : 'bg-muted/50 text-foreground')}>
        {errorText && <div>{errorText}</div>}
        {output && <div>{output}</div>}
      </div>
    </div>
  );
};
