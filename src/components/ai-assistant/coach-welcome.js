/**
 * The AI coach's welcome on an empty chat: a little robot that blinks, idles
 * with the odd wiggle, looks at the question under the pointer and hops when
 * one is picked, over a slowly drifting colour glow. A fresh PR in the latest
 * session gets a trophy pill and a cheering robot.
 *
 * Also home to the pieces the chat shares with it: SuggestionChip (the opening
 * questions and the follow-ups under each answer) and the composer textarea
 * that types out example questions as its placeholder.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Sparkles, Trophy } from "lucide-react";

import { Suggestions, Suggestion } from "@/components/ai-elements/suggestion";
import { PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { cn } from "@/lib/utils";

const IDLE_MOVES = ["coach-bot-wiggle", "coach-bot-nod", "coach-bot-hop"];

// Long enough to see the hop before the welcome gives way to the chat.
const PICK_DELAY_MS = 320;

/**
 * A suggested question as a pill that fades up in turn, with a hover arrow.
 * @param {Object} props
 * @param {string} props.question
 * @param {number} props.index Position in the set, for the staggered entrance.
 * @param {React.ComponentType} [props.icon] Leading icon, Sparkles by default.
 * @param {boolean} [props.disabled]
 * @param {(question: string) => void} props.onSelect
 */
export function SuggestionChip({
  question,
  index,
  icon: Icon = Sparkles,
  disabled,
  onSelect,
  ...props
}) {
  return (
    <Suggestion
      className="group border-border/70 bg-background text-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-foreground disabled:text-muted-foreground animate-in fade-in slide-in-from-bottom-2 fill-mode-both h-auto min-h-9 gap-2 py-2 pr-3 pl-3.5 text-left whitespace-normal shadow-xs duration-500 hover:-translate-y-px hover:shadow-sm"
      style={{ animationDelay: `${index * 70}ms` }}
      suggestion={question}
      disabled={disabled}
      onClick={onSelect}
      {...props}
    >
      <Icon className="text-primary/70 group-hover:text-primary size-3.5 shrink-0 transition-colors" />
      <span>{question}</span>
      <ArrowRight className="text-primary size-3.5 shrink-0 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
    </Suggestion>
  );
}

/**
 * @param {Object} props
 * @param {string} props.greeting
 * @param {string} props.description
 * @param {{ label: string }|null} [props.celebration] A fresh PR to cheer.
 * @param {{ text: string, icon: React.ComponentType }[]|null} props.suggestions
 *   Null until the chat has hydrated, so the chips don't flash.
 * @param {boolean} [props.disabled]
 * @param {(question: string) => void} props.onSelect
 */
export function CoachWelcome({
  greeting,
  description,
  celebration,
  suggestions,
  disabled,
  onSelect,
}) {
  const robotRef = useRef(null);
  const pickedRef = useRef(false);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [isHappy, setIsHappy] = useState(false);
  const [move, setMove] = useState({ name: null, count: 0 });

  const playMove = useCallback((name) => {
    setMove((previous) => ({ name, count: previous.count + 1 }));
  }, []);

  // Idle: a random move after a random gap. A PR opens with a double hop.
  useEffect(() => {
    let timer;
    const scheduleNext = (delay) => {
      timer = setTimeout(() => {
        playMove(IDLE_MOVES[Math.floor(Math.random() * IDLE_MOVES.length)]);
        scheduleNext(2500 + Math.random() * 4500);
      }, delay);
    };
    if (celebration) {
      timer = setTimeout(() => {
        playMove("coach-bot-cheer");
        scheduleNext(4000);
      }, 700);
    } else {
      scheduleNext(2500 + Math.random() * 2500);
    }
    return () => clearTimeout(timer);
  }, [celebration, playMove]);

  // The eyes follow whichever chip the pointer or keyboard is on.
  function lookAt(event) {
    const robot = robotRef.current?.getBoundingClientRect();
    const chip = event.currentTarget.getBoundingClientRect();
    if (!robot) return;
    const dx = chip.left + chip.width / 2 - (robot.left + robot.width / 2);
    const dy = chip.top + chip.height / 2 - (robot.top + robot.height / 2);
    const length = Math.hypot(dx, dy) || 1;
    setLook({ x: dx / length, y: dy / length });
    setIsHappy(true);
  }

  function lookAway() {
    setLook({ x: 0, y: 0 });
    setIsHappy(false);
  }

  function pick(question) {
    if (pickedRef.current) return;
    pickedRef.current = true;
    setIsHappy(true);
    playMove("coach-bot-hop");
    setTimeout(() => {
      pickedRef.current = false;
      onSelect(question);
    }, PICK_DELAY_MS);
  }

  return (
    <div className="relative flex w-full flex-col items-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-10 bottom-0 overflow-hidden"
      >
        <div className="coach-glow-a bg-chart-1/25 dark:bg-chart-1/15 absolute top-0 left-1/2 size-72 -translate-x-[70%] rounded-full blur-3xl" />
        <div className="coach-glow-b bg-chart-2/25 dark:bg-chart-2/15 absolute top-16 left-1/2 size-64 -translate-x-[20%] rounded-full blur-3xl" />
      </div>
      <div className="relative flex w-full max-w-3xl flex-col items-center gap-3">
        <div
          ref={robotRef}
          className="animate-in fade-in zoom-in-75 border-primary/20 from-primary/15 to-primary/5 text-primary bg-background/60 flex size-16 items-center justify-center rounded-2xl border bg-gradient-to-br shadow-sm backdrop-blur-sm duration-700"
        >
          <CoachRobot
            look={look}
            isHappy={isHappy}
            isCelebrating={Boolean(celebration)}
            move={move}
          />
        </div>
        {celebration && (
          <div className="animate-in fade-in zoom-in-90 border-primary/30 bg-primary/10 text-foreground mt-1 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium duration-700">
            <Trophy className="text-primary size-3.5" />
            {celebration.label}
          </div>
        )}
        <h3 className="animate-in fade-in slide-in-from-bottom-1 text-center text-xl font-semibold tracking-tight duration-700 sm:text-2xl">
          {greeting}
        </h3>
        <p className="text-muted-foreground animate-in fade-in max-w-md text-center text-sm duration-1000">
          {description}
        </p>
        {suggestions && (
          <Suggestions className="mt-5 justify-center gap-2.5">
            {suggestions.map(({ text, icon }, i) => (
              <SuggestionChip
                key={text}
                question={text}
                index={i + 3}
                icon={icon}
                disabled={disabled}
                onSelect={pick}
                onPointerEnter={lookAt}
                onPointerLeave={lookAway}
                onFocus={lookAt}
                onBlur={lookAway}
              />
            ))}
          </Suggestions>
        )}
      </div>
    </div>
  );
}

/**
 * The robot head, drawn to match the Lucide Bot icon so it can blink, glance
 * and smile. Blinks on its own every few seconds, sometimes twice.
 */
function CoachRobot({ look, isHappy, isCelebrating, move }) {
  const [blink, setBlink] = useState({ name: null, count: 0 });

  useEffect(() => {
    let timer;
    const scheduleNext = () => {
      timer = setTimeout(
        () => {
          setBlink((previous) => ({
            name:
              Math.random() < 0.25
                ? "coach-bot-blink-double"
                : "coach-bot-blink",
            count: previous.count + 1,
          }));
          scheduleNext();
        },
        2000 + Math.random() * 4000,
      );
    };
    scheduleNext();
    return () => clearTimeout(timer);
  }, []);

  return (
    // The key restarts the move even when the same one repeats
    <svg
      key={move.count}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("size-9 overflow-visible", move.name)}
    >
      <path d="M12 8V5" />
      <circle
        cx="12"
        cy="3.5"
        r="1.25"
        fill="currentColor"
        className={isCelebrating ? "coach-bot-antenna-glow" : undefined}
      />
      <rect x="4" y="8" width="16" height="12" rx="3.5" />
      <path d="M2 13v2M22 13v2" />
      <g
        style={{
          transform: `translate(${look.x * 1.5}px, ${look.y * 1.1}px)`,
          transition: "transform 250ms ease-out",
        }}
      >
        <g key={blink.count} className={blink.name ?? undefined}>
          <rect
            x="8"
            y="11.75"
            width="2"
            height="3"
            rx="1"
            fill="currentColor"
            stroke="none"
          />
          <rect
            x="14"
            y="11.75"
            width="2"
            height="3"
            rx="1"
            fill="currentColor"
            stroke="none"
          />
        </g>
      </g>
      <path
        d={isHappy ? "M9.5 16.75q2.5 1.9 5 0" : "M10.5 17.25q1.5 0.7 3 0"}
      />
    </svg>
  );
}

const TYPED_EXAMPLES = [
  "How do I warm up for a heavy single?",
  "Is my bench keeping pace with my squat?",
  "Plan a lighter week for me",
  "What should I eat before a big session?",
  "Which accessory would help my deadlift lockout?",
  "How many sets a week should I do for squats?",
];

const TYPE_MS = 45;
const ERASE_MS = 18;
const HOLD_MS = 2200;

/**
 * The composer textarea, typing out example questions as its placeholder.
 * Its own component so the typing re-renders only the textarea, not the chat.
 * @param {Object} props
 * @param {boolean} props.isTyping False shows staticPlaceholder instead.
 * @param {string} props.staticPlaceholder
 */
export function TypedPlaceholderTextarea({
  isTyping,
  staticPlaceholder,
  ...props
}) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!isTyping) return;
    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let phrase = Math.floor(Math.random() * TYPED_EXAMPLES.length);
    let length = 0;
    let erasing = false;
    let timer;

    const tick = () => {
      const text = TYPED_EXAMPLES[phrase];
      if (reduceMotion) {
        setTyped(text);
        phrase = (phrase + 1) % TYPED_EXAMPLES.length;
        timer = setTimeout(tick, HOLD_MS * 2);
        return;
      }
      if (!erasing) {
        length += 1;
        setTyped(text.slice(0, length));
        if (length >= text.length) {
          erasing = true;
          timer = setTimeout(tick, HOLD_MS);
          return;
        }
        timer = setTimeout(tick, TYPE_MS);
        return;
      }
      length -= 1;
      setTyped(text.slice(0, length));
      if (length <= 0) {
        erasing = false;
        phrase = (phrase + 1) % TYPED_EXAMPLES.length;
      }
      timer = setTimeout(tick, length <= 0 ? 400 : ERASE_MS);
    };

    timer = setTimeout(tick, 900);
    return () => clearTimeout(timer);
  }, [isTyping]);

  return (
    <PromptInputTextarea
      placeholder={isTyping && typed ? typed : staticPlaceholder}
      {...props}
    />
  );
}
