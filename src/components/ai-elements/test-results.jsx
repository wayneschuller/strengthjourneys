"use client";;
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  CheckCircle2Icon,
  ChevronRightIcon,
  CircleDotIcon,
  CircleIcon,
  XCircleIcon,
} from "lucide-react";
import { createContext, useContext } from "react";

const TestResultsContext = createContext({});

const formatDuration = (ms) => {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
};

export const TestResults = ({
  summary,
  className,
  children,
  ...props
}) => (
  <TestResultsContext.Provider value={{ summary }}>
    <div className={cn("rounded-lg border bg-background", className)} {...props}>
      {children ??
        (summary && (
          <TestResultsHeader>
            <TestResultsSummary />
            <TestResultsDuration />
          </TestResultsHeader>
        ))}
    </div>
  </TestResultsContext.Provider>
);

export const TestResultsHeader = ({
  className,
  children,
  ...props
}) => (
  <div
    className={cn("flex items-center justify-between border-b px-4 py-3", className)}
    {...props}>
    {children}
  </div>
);

export const TestResultsSummary = ({
  className,
  children,
  ...props
}) => {
  const { summary } = useContext(TestResultsContext);

  if (!summary) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-3", className)} {...props}>
      {children ?? (
        <>
          <Badge
            className="gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            variant="secondary">
            <CheckCircle2Icon className="size-3" />
            {summary.passed} passed
          </Badge>
          {summary.failed > 0 && (
            <Badge
              className="gap-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              variant="secondary">
              <XCircleIcon className="size-3" />
              {summary.failed} failed
            </Badge>
          )}
          {summary.skipped > 0 && (
            <Badge
              className="gap-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
              variant="secondary">
              <CircleIcon className="size-3" />
              {summary.skipped} skipped
            </Badge>
          )}
        </>
      )}
    </div>
  );
};

export const TestResultsDuration = ({
  className,
  children,
  ...props
}) => {
  const { summary } = useContext(TestResultsContext);

  if (!summary?.duration) {
    return null;
  }

  return (
    <span className={cn("text-muted-foreground text-sm", className)} {...props}>
      {children ?? formatDuration(summary.duration)}
    </span>
  );
};

export const TestResultsProgress = ({
  className,
  children,
  ...props
}) => {
  const { summary } = useContext(TestResultsContext);

  if (!summary) {
    return null;
  }

  const passedPercent = (summary.passed / summary.total) * 100;
  const failedPercent = (summary.failed / summary.total) * 100;

  return (
    <div className={cn("space-y-2", className)} {...props}>
      {children ?? (
        <>
          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="bg-green-500 transition-all"
              style={{ width: `${passedPercent}%` }} />
            <div
              className="bg-red-500 transition-all"
              style={{ width: `${failedPercent}%` }} />
          </div>
          <div className="flex justify-between text-muted-foreground text-xs">
            <span>
              {summary.passed}/{summary.total} tests passed
            </span>
            <span>{passedPercent.toFixed(0)}%</span>
          </div>
        </>
      )}
    </div>
  );
};

export const TestResultsContent = ({
  className,
  children,
  ...props
}) => (
  <div className={cn("space-y-2 p-4", className)} {...props}>
    {children}
  </div>
);

const TestSuiteContext = createContext({
  name: "",
  status: "passed",
});

export const TestSuite = ({
  name,
  status,
  className,
  children,
  ...props
}) => (
  <TestSuiteContext.Provider value={{ name, status }}>
    <Collapsible className={cn("rounded-lg border", className)} {...props}>
      {children}
    </Collapsible>
  </TestSuiteContext.Provider>
);

export const TestSuiteName = ({
  className,
  children,
  ...props
}) => {
  const { name, status } = useContext(TestSuiteContext);

  return (
    <CollapsibleTrigger
      className={cn(
        "group flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/50",
        className
      )}
      {...props}>
      <ChevronRightIcon
        className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
      <TestStatusIcon status={status} />
      <span className="font-medium text-sm">{children ?? name}</span>
    </CollapsibleTrigger>
  );
};

export const TestSuiteStats = ({
  passed = 0,
  failed = 0,
  skipped = 0,
  className,
  children,
  ...props
}) => (
  <div
    className={cn("ml-auto flex items-center gap-2 text-xs", className)}
    {...props}>
    {children ?? (
      <>
        {passed > 0 && (
          <span className="text-green-600 dark:text-green-400">
            {passed} passed
          </span>
        )}
        {failed > 0 && (
          <span className="text-red-600 dark:text-red-400">
            {failed} failed
          </span>
        )}
        {skipped > 0 && (
          <span className="text-yellow-600 dark:text-yellow-400">
            {skipped} skipped
          </span>
        )}
      </>
    )}
  </div>
);

export const TestSuiteContent = ({
  className,
  children,
  ...props
}) => (
  <CollapsibleContent className={cn("border-t", className)} {...props}>
    <div className="divide-y">{children}</div>
  </CollapsibleContent>
);

const TestContext = createContext({
  name: "",
  status: "passed",
});

export const Test = ({
  name,
  status,
  duration,
  className,
  children,
  ...props
}) => (
  <TestContext.Provider value={{ duration, name, status }}>
    <div
      className={cn("flex items-center gap-2 px-4 py-2 text-sm", className)}
      {...props}>
      {children ?? (
        <>
          <TestStatus />
          <TestName />
          {duration !== undefined && <TestDuration />}
        </>
      )}
    </div>
  </TestContext.Provider>
);

const statusStyles = {
  failed: "text-red-600 dark:text-red-400",
  passed: "text-green-600 dark:text-green-400",
  running: "text-blue-600 dark:text-blue-400",
  skipped: "text-yellow-600 dark:text-yellow-400",
};

const statusIcons = {
  failed: <XCircleIcon className="size-4" />,
  passed: <CheckCircle2Icon className="size-4" />,
  running: <CircleDotIcon className="size-4 animate-pulse" />,
  skipped: <CircleIcon className="size-4" />,
};

const TestStatusIcon = ({
  status
}) => (
  <span className={cn("shrink-0", statusStyles[status])}>
    {statusIcons[status]}
  </span>
);

export const TestStatus = ({
  className,
  children,
  ...props
}) => {
  const { status } = useContext(TestContext);

  return (
    <span className={cn("shrink-0", statusStyles[status], className)} {...props}>
      {children ?? statusIcons[status]}
    </span>
  );
};

export const TestName = ({
  className,
  children,
  ...props
}) => {
  const { name } = useContext(TestContext);

  return (
    <span className={cn("flex-1", className)} {...props}>
      {children ?? name}
    </span>
  );
};

export const TestDuration = ({
  className,
  children,
  ...props
}) => {
  const { duration } = useContext(TestContext);

  if (duration === undefined) {
    return null;
  }

  return (
    <span
      className={cn("ml-auto text-muted-foreground text-xs", className)}
      {...props}>
      {children ?? `${duration}ms`}
    </span>
  );
};

export const TestError = ({
  className,
  children,
  ...props
}) => (
  <div
    className={cn("mt-2 rounded-md bg-red-50 p-3 dark:bg-red-900/20", className)}
    {...props}>
    {children}
  </div>
);

export const TestErrorMessage = ({
  className,
  children,
  ...props
}) => (
  <p
    className={cn("font-medium text-red-700 text-sm dark:text-red-400", className)}
    {...props}>
    {children}
  </p>
);

export const TestErrorStack = ({
  className,
  children,
  ...props
}) => (
  <pre
    className={cn(
      "mt-2 overflow-auto font-mono text-red-600 text-xs dark:text-red-400",
      className
    )}
    {...props}>
    {children}
  </pre>
);
