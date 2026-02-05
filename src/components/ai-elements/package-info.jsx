"use client";;
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowRightIcon, MinusIcon, PackageIcon, PlusIcon } from "lucide-react";
import { createContext, useContext } from "react";

const PackageInfoContext = createContext({
  name: "",
});

export const PackageInfo = ({
  name,
  currentVersion,
  newVersion,
  changeType,
  className,
  children,
  ...props
}) => (
  <PackageInfoContext.Provider value={{ changeType, currentVersion, name, newVersion }}>
    <div
      className={cn("rounded-lg border bg-background p-4", className)}
      {...props}>
      {children ?? (
        <>
          <PackageInfoHeader>
            <PackageInfoName />
            {changeType && <PackageInfoChangeType />}
          </PackageInfoHeader>
          {(currentVersion || newVersion) && <PackageInfoVersion />}
        </>
      )}
    </div>
  </PackageInfoContext.Provider>
);

export const PackageInfoHeader = ({
  className,
  children,
  ...props
}) => (
  <div
    className={cn("flex items-center justify-between gap-2", className)}
    {...props}>
    {children}
  </div>
);

export const PackageInfoName = ({
  className,
  children,
  ...props
}) => {
  const { name } = useContext(PackageInfoContext);

  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      <PackageIcon className="size-4 text-muted-foreground" />
      <span className="font-medium font-mono text-sm">{children ?? name}</span>
    </div>
  );
};

const changeTypeStyles = {
  added: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  major: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  minor:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  patch: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  removed: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
};

const changeTypeIcons = {
  added: <PlusIcon className="size-3" />,
  major: <ArrowRightIcon className="size-3" />,
  minor: <ArrowRightIcon className="size-3" />,
  patch: <ArrowRightIcon className="size-3" />,
  removed: <MinusIcon className="size-3" />,
};

export const PackageInfoChangeType = ({
  className,
  children,
  ...props
}) => {
  const { changeType } = useContext(PackageInfoContext);

  if (!changeType) {
    return null;
  }

  return (
    <Badge
      className={cn("gap-1 text-xs capitalize", changeTypeStyles[changeType], className)}
      variant="secondary"
      {...props}>
      {changeTypeIcons[changeType]}
      {children ?? changeType}
    </Badge>
  );
};

export const PackageInfoVersion = ({
  className,
  children,
  ...props
}) => {
  const { currentVersion, newVersion } = useContext(PackageInfoContext);

  if (!(currentVersion || newVersion)) {
    return null;
  }

  return (
    <div
      className={cn(
        "mt-2 flex items-center gap-2 font-mono text-muted-foreground text-sm",
        className
      )}
      {...props}>
      {children ?? (
        <>
          {currentVersion && <span>{currentVersion}</span>}
          {currentVersion && newVersion && (
            <ArrowRightIcon className="size-3" />
          )}
          {newVersion && (
            <span className="font-medium text-foreground">{newVersion}</span>
          )}
        </>
      )}
    </div>
  );
};

export const PackageInfoDescription = ({
  className,
  children,
  ...props
}) => (
  <p
    className={cn("mt-2 text-muted-foreground text-sm", className)}
    {...props}>
    {children}
  </p>
);

export const PackageInfoContent = ({
  className,
  children,
  ...props
}) => (
  <div className={cn("mt-3 border-t pt-3", className)} {...props}>
    {children}
  </div>
);

export const PackageInfoDependencies = ({
  className,
  children,
  ...props
}) => (
  <div className={cn("space-y-2", className)} {...props}>
    <span
      className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
      Dependencies
    </span>
    <div className="space-y-1">{children}</div>
  </div>
);

export const PackageInfoDependency = ({
  name,
  version,
  className,
  children,
  ...props
}) => (
  <div
    className={cn("flex items-center justify-between text-sm", className)}
    {...props}>
    {children ?? (
      <>
        <span className="font-mono text-muted-foreground">{name}</span>
        {version && <span className="font-mono text-xs">{version}</span>}
      </>
    )}
  </div>
);
