"use client";;
import { cn } from "@/lib/utils";
import {
  useRive,
  useStateMachineInput,
  useViewModel,
  useViewModelInstance,
  useViewModelInstanceColor,
} from "@rive-app/react-webgl2";
import { memo, useEffect, useMemo, useRef, useState } from "react";

// The state machine name is always 'default' for Elements AI visuals
const stateMachine = "default";

const sources = {
  command: {
    dynamicColor: true,
    hasModel: true,
    source:
      "https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/command-2.0.riv",
  },
  glint: {
    dynamicColor: true,
    hasModel: true,
    source:
      "https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/glint-2.0.riv",
  },
  halo: {
    dynamicColor: true,
    hasModel: true,
    source:
      "https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/halo-2.0.riv",
  },
  mana: {
    dynamicColor: false,
    hasModel: true,
    source:
      "https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/mana-2.0.riv",
  },
  obsidian: {
    dynamicColor: true,
    hasModel: true,
    source:
      "https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/obsidian-2.0.riv",
  },
  opal: {
    dynamicColor: false,
    hasModel: false,
    source:
      "https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/orb-1.2.riv",
  },
};

const getCurrentTheme = () => {
  if (typeof window !== "undefined") {
    if (document.documentElement.classList.contains("dark")) {
      return "dark";
    }
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
  }
  return "light";
};

const useTheme = (enabled) => {
  const [theme, setTheme] = useState(getCurrentTheme);

  useEffect(() => {
    // Skip if not enabled (avoids unnecessary observers for non-dynamic-color variants)
    if (!enabled) {
      return;
    }

    // Watch for classList changes
    const observer = new MutationObserver(() => {
      setTheme(getCurrentTheme());
    });

    observer.observe(document.documentElement, {
      attributeFilter: ["class"],
      attributes: true,
    });

    // Watch for OS-level theme changes
    let mql = null;
    const handleMediaChange = () => {
      setTheme(getCurrentTheme());
    };

    if (window.matchMedia) {
      mql = window.matchMedia("(prefers-color-scheme: dark)");
      mql.addEventListener("change", handleMediaChange);
    }

    return () => {
      observer.disconnect();
      if (mql) {
        mql.removeEventListener("change", handleMediaChange);
      }
    };
  }, [enabled]);

  return theme;
};

const PersonaWithModel = memo(({
  rive,
  source,
  children
}) => {
  const theme = useTheme(source.dynamicColor);
  const viewModel = useViewModel(rive, { useDefault: true });
  const viewModelInstance = useViewModelInstance(viewModel, {
    rive,
    useDefault: true,
  });
  const viewModelInstanceColor = useViewModelInstanceColor("color", viewModelInstance);

  useEffect(() => {
    if (!(viewModelInstanceColor && source.dynamicColor)) {
      return;
    }

    const [r, g, b] = theme === "dark" ? [255, 255, 255] : [0, 0, 0];
    viewModelInstanceColor.setRgb(r, g, b);
  }, [viewModelInstanceColor, theme, source.dynamicColor]);

  return children;
});

PersonaWithModel.displayName = "PersonaWithModel";

const PersonaWithoutModel = memo(({
  children
}) => children);

PersonaWithoutModel.displayName = "PersonaWithoutModel";

export const Persona = memo(({
  variant = "obsidian",
  state = "idle",
  onLoad,
  onLoadError,
  onReady,
  onPause,
  onPlay,
  onStop,
  className,
}) => {
  const source = sources[variant];

  if (!source) {
    throw new Error(`Invalid variant: ${variant}`);
  }

  // Stabilize callbacks to prevent useRive from reinitializing
  const callbacksRef = useRef({
    onLoad,
    onLoadError,
    onPause,
    onPlay,
    onReady,
    onStop,
  });
  callbacksRef.current = {
    onLoad,
    onLoadError,
    onPause,
    onPlay,
    onReady,
    onStop,
  };

  const stableCallbacks = useMemo(() => ({
    onLoad: (loadedRive => callbacksRef.current.onLoad?.(loadedRive)),
    onLoadError: (err => callbacksRef.current.onLoadError?.(err)),
    onPause: (event => callbacksRef.current.onPause?.(event)),
    onPlay: (event => callbacksRef.current.onPlay?.(event)),
    onReady: () => callbacksRef.current.onReady?.(),
    onStop: (event => callbacksRef.current.onStop?.(event)),
  }), []);

  const { rive, RiveComponent } = useRive({
    autoplay: true,
    onLoad: stableCallbacks.onLoad,
    onLoadError: stableCallbacks.onLoadError,
    onPause: stableCallbacks.onPause,
    onPlay: stableCallbacks.onPlay,
    onRiveReady: stableCallbacks.onReady,
    onStop: stableCallbacks.onStop,
    src: source.source,
    stateMachines: stateMachine,
  });

  const listeningInput = useStateMachineInput(rive, stateMachine, "listening");
  const thinkingInput = useStateMachineInput(rive, stateMachine, "thinking");
  const speakingInput = useStateMachineInput(rive, stateMachine, "speaking");
  const asleepInput = useStateMachineInput(rive, stateMachine, "asleep");

  useEffect(() => {
    if (listeningInput) {
      listeningInput.value = state === "listening";
    }
    if (thinkingInput) {
      thinkingInput.value = state === "thinking";
    }
    if (speakingInput) {
      speakingInput.value = state === "speaking";
    }
    if (asleepInput) {
      asleepInput.value = state === "asleep";
    }
  }, [state, listeningInput, thinkingInput, speakingInput, asleepInput]);

  const Component = source.hasModel ? PersonaWithModel : PersonaWithoutModel;

  return (
    <Component rive={rive} source={source}>
      <RiveComponent className={cn("size-16 shrink-0", className)} />
    </Component>
  );
});

Persona.displayName = "Persona";
