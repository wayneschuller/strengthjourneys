'use client';;
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { createContext, useContext, useEffect, useState } from 'react';

const BranchContext = createContext(null);

const useBranch = () => {
  const context = useContext(BranchContext);

  if (!context) {
    throw new Error('Branch components must be used within Branch');
  }

  return context;
};

export const Branch = ({
  defaultBranch = 0,
  onBranchChange,
  className,
  ...props
}) => {
  const [currentBranch, setCurrentBranch] = useState(defaultBranch);
  const [branches, setBranches] = useState([]);

  const handleBranchChange = (newBranch) => {
    setCurrentBranch(newBranch);
    onBranchChange?.(newBranch);
  };

  const goToPrevious = () => {
    const newBranch =
      currentBranch > 0 ? currentBranch - 1 : branches.length - 1;
    handleBranchChange(newBranch);
  };

  const goToNext = () => {
    const newBranch =
      currentBranch < branches.length - 1 ? currentBranch + 1 : 0;
    handleBranchChange(newBranch);
  };

  const contextValue = {
    currentBranch,
    totalBranches: branches.length,
    goToPrevious,
    goToNext,
    branches,
    setBranches,
  };

  return (
    <BranchContext.Provider value={contextValue}>
      <div className={cn('grid w-full gap-2 [&>div]:pb-0', className)} {...props} />
    </BranchContext.Provider>
  );
};

export const BranchMessages = ({
  children,
  ...props
}) => {
  const { currentBranch, setBranches, branches } = useBranch();
  const childrenArray = Array.isArray(children) ? children : [children];

  // Use useEffect to update branches when they change
  useEffect(() => {
    if (branches.length !== childrenArray.length) {
      setBranches(childrenArray);
    }
  }, [childrenArray, branches, setBranches]);

  return childrenArray.map((branch, index) => (
    <div
      className={cn(
        'grid gap-2 overflow-hidden [&>div]:pb-0',
        index === currentBranch ? 'block' : 'hidden'
      )}
      key={branch.key}
      {...props}>
      {branch}
    </div>
  ));
};

export const BranchSelector = ({
  className,
  from,
  ...props
}) => {
  const { totalBranches } = useBranch();

  // Don't render if there's only one branch
  if (totalBranches <= 1) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 self-end px-10',
        from === 'assistant' ? 'justify-start' : 'justify-end',
        className
      )}
      {...props} />
  );
};

export const BranchPrevious = ({
  className,
  children,
  ...props
}) => {
  const { goToPrevious, totalBranches } = useBranch();

  return (
    <Button
      aria-label="Previous branch"
      className={cn(
        'size-7 shrink-0 rounded-full text-muted-foreground transition-colors',
        'hover:bg-accent hover:text-foreground',
        'disabled:pointer-events-none disabled:opacity-50',
        className
      )}
      disabled={totalBranches <= 1}
      onClick={goToPrevious}
      size="icon"
      type="button"
      variant="ghost"
      {...props}>
      {children ?? <ChevronLeftIcon size={14} />}
    </Button>
  );
};

export const BranchNext = ({
  className,
  children,
  ...props
}) => {
  const { goToNext, totalBranches } = useBranch();

  return (
    <Button
      aria-label="Next branch"
      className={cn(
        'size-7 shrink-0 rounded-full text-muted-foreground transition-colors',
        'hover:bg-accent hover:text-foreground',
        'disabled:pointer-events-none disabled:opacity-50',
        className
      )}
      disabled={totalBranches <= 1}
      onClick={goToNext}
      size="icon"
      type="button"
      variant="ghost"
      {...props}>
      {children ?? <ChevronRightIcon size={14} />}
    </Button>
  );
};

export const BranchPage = ({
  className,
  ...props
}) => {
  const { currentBranch, totalBranches } = useBranch();

  return (
    <span
      className={cn('font-medium text-muted-foreground text-xs tabular-nums', className)}
      {...props}>
      {currentBranch + 1}of {totalBranches}
    </span>
  );
};
