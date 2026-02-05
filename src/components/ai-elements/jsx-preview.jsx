"use client";;
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import JsxParser from "react-jsx-parser";

const JSXPreviewContext = createContext(null);

const TAG_REGEX = /<\/?([a-zA-Z][a-zA-Z0-9]*)\s*([^>]*?)(\/)?>/;

export const useJSXPreview = () => {
  const context = useContext(JSXPreviewContext);
  if (!context) {
    throw new Error("JSXPreview components must be used within JSXPreview");
  }
  return context;
};

const matchJsxTag = (code) => {
  if (code.trim() === "") {
    return null;
  }

  const match = code.match(TAG_REGEX);

  if (!match || match.index === undefined) {
    return null;
  }

  const [fullMatch, tagName, attributes, selfClosing] = match;

  let type;
  if (selfClosing) {
    type = "self-closing";
  } else if (fullMatch.startsWith("</")) {
    type = "closing";
  } else {
    type = "opening";
  }

  return {
    attributes: attributes.trim(),
    endIndex: match.index + fullMatch.length,
    startIndex: match.index,
    tag: fullMatch,
    tagName,
    type,
  };
};

const completeJsxTag = (code) => {
  const stack = [];
  let result = "";
  let currentPosition = 0;

  while (currentPosition < code.length) {
    const match = matchJsxTag(code.slice(currentPosition));
    if (!match) {
      // No more tags found, append remaining content
      result += code.slice(currentPosition);
      break;
    }
    const { tagName, type, endIndex } = match;

    // Include any text content before this tag
    result += code.slice(currentPosition, currentPosition + endIndex);

    if (type === "opening") {
      stack.push(tagName);
    } else if (type === "closing") {
      stack.pop();
    }

    currentPosition += endIndex;
  }

  return (result + stack
    .toReversed()
    .map((tag) => `</${tag}>`)
    .join(""));
};

export const JSXPreview = memo(({
  jsx,
  isStreaming = false,
  components,
  bindings,
  onError,
  className,
  children,
  ...props
}) => {
  const [error, setError] = useState(null);

  const processedJsx = useMemo(() => (isStreaming ? completeJsxTag(jsx) : jsx), [jsx, isStreaming]);

  // Clear error when jsx changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: jsx change should reset error
  useEffect(() => {
    setError(null);
  }, [jsx]);

  return (
    <JSXPreviewContext.Provider
      value={{
        bindings,
        components,
        error,
        jsx,
        onErrorProp: onError,
        processedJsx,
        setError,
      }}>
      <div className={cn("relative", className)} {...props}>
        {children}
      </div>
    </JSXPreviewContext.Provider>
  );
});

JSXPreview.displayName = "JSXPreview";

export const JSXPreviewContent = memo(({
  className,
  ...props
}) => {
  const { processedJsx, components, bindings, setError, onErrorProp } =
    useJSXPreview();
  const errorReportedRef = useRef(null);

  // Reset error tracking when jsx changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: processedJsx change should reset tracking
  useEffect(() => {
    errorReportedRef.current = null;
  }, [processedJsx]);

  const handleError = useCallback((err) => {
    // Prevent duplicate error reports for the same jsx
    if (errorReportedRef.current === processedJsx) {
      return;
    }
    errorReportedRef.current = processedJsx;
    setError(err);
    onErrorProp?.(err);
  }, [processedJsx, onErrorProp, setError]);

  return (
    <div className={cn("jsx-preview-content", className)} {...props}>
      <JsxParser
        bindings={bindings}
        components={components}
        jsx={processedJsx}
        onError={handleError}
        renderInWrapper={false} />
    </div>
  );
});

JSXPreviewContent.displayName = "JSXPreviewContent";

const renderChildren = (children, error) => {
  if (typeof children === "function") {
    return children(error);
  }
  return children;
};

export const JSXPreviewError = memo(({
  className,
  children,
  ...props
}) => {
  const { error } = useJSXPreview();

  if (!error) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-destructive text-sm",
        className
      )}
      {...props}>
      {children ? (
        renderChildren(children, error)
      ) : (
        <>
          <AlertCircle className="size-4 shrink-0" />
          <span>{error.message}</span>
        </>
      )}
    </div>
  );
});

JSXPreviewError.displayName = "JSXPreviewError";
