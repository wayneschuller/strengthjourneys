import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const INSPIRATIONAL_QUOTES = [
  {
    quote:
      "Strong people are harder to kill than weak people and more useful in general. A weak man is not as happy as that same man would be if he were strong.",
    author: "Mark Rippetoe, Starting Strength",
    URL: "https://startingstrength.com/",
  },
  {
    quote: "The only bad workout is the one that didn't happen.",
    author: "Unknown",
    URL: null,
  },
  {
    quote:
      "In the military we always say we don’t rise to the level of our expectations, we fall to the level of our training",
    author: "David Goggins",
    URL: "https://grokipedia.com/page/David_Goggins",
  },
  {
    quote: "Whether you think you can, or you think you can’t, you’re right.",
    author: "Henry Ford",
    URL: "https://grokipedia.com/page/Henry_Ford",
  },
  {
    quote:
      "For me, life is continuously being hungry. The meaning of life is not simply to exist, to survive, but to move ahead, to go up, to achieve, to conquer.",
    author: "Arnold Schwarzenegger",
    URL: "https://grokipedia.com/page/Arnold_Schwarzenegger",
  },
  {
    quote:
      "I have my own therapy. I will choose the iron to feel what most other people only feel when someone else tells them to. Those that use the iron as therapy and as an escape really get it, because the mind and body are one - working, thriving, and alive.",
    author: "Jim Steel",
    URL: "https://www.basbarbell.com/",
  },
  {
    quote:
      "Life in the weight room is like working on a building that is always under construction. Work is never complete, so learn to fall in love with the process.",
    author: "Dr. Aaron Horschig (Squat University)",
    URL: "https://squatuniversity.com/",
  },
  {
    quote:
      "I hated every minute of training, but I said, 'Don't quit. Suffer now and live the rest of your life as a champion.'",
    author: "Muhammad Ali",
    URL: "https://grokipedia.com/page/Muhammad_Ali",
  },
  {
    quote: "Slowly is the fastest way to get to where you want to be.",
    author: "Andre De Shields",
    URL: "https://grokipedia.com/page/Andre_De_Shields",
  },
  {
    quote:
      "The weight room is a place where the trials never end. It is the place where we test ourselves continuously - we struggle to reach one goal, and, as soon as we reach it, there is another and more difficult one to meet.",
    author: "Dave Tate, EliteFTS",
    URL: "https://www.elitefts.com/",
  },
  {
    quote:
      "Your health will likely run out before your money. Invest proportionally.",
    author: "Source unknown",
    URL: null,
  },
  {
    quote:
      "Ask yourself: What can I take away from today that was a win? Even if it was just turning up at the gym, going out on a walk, or doing one little thing that was positive.",
    author: "Craig Richey",
    URL: "https://www.youtube.com/@TeamRichey",
  },
  {
    quote:
      "When you start to treat the light weights like heavy weights, the heavy weights will go up a lot easier.",
    author: "Ed Coan",
    URL: "https://grokipedia.com/page/Ed_Coan",
  },
  {
    quote:
      "No man has the right to be an amateur in the matter of physical training. It is a shame for a man to grow old without seeing the beauty and strength of which his body is capable.",
    author: "Socrates",
    URL: "https://grokipedia.com/page/Socrates",
  },
];

function getSeededQuote(seedKey = "default") {
  const key = String(seedKey);
  let hash = 0;

  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }

  return INSPIRATIONAL_QUOTES[hash % INSPIRATIONAL_QUOTES.length];
}

export function InspirationCard({
  seedKey = "default",
  title = "Training note",
  variant = "default",
  className = "",
}) {
  const quote = getSeededQuote(seedKey);
  const isRail = variant === "rail";

  return (
    <Card
      className={cn(
        isRail && "border-border/35 bg-muted/8 shadow-sm",
        className,
      )}
    >
      <CardHeader className={cn(isRail ? "space-y-2 px-4 pb-0 pt-4" : "")}>
        <CardTitle
          className={cn(
            isRail
              ? "text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
              : "",
          )}
        >
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className={cn(isRail ? "space-y-4 px-4 pb-4 pt-3" : "")}>
        <blockquote
          className={cn(
            isRail
              ? "text-sm leading-6 text-muted-foreground"
              : "text-xl italic md:text-2xl",
          )}
        >
          <span className={cn(isRail ? "text-foreground/90" : "")}>
            &ldquo;{quote.quote}&rdquo;
          </span>
        </blockquote>
        <div
          className={cn(
            isRail
              ? "text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground"
              : "text-right text-lg md:text-xl",
          )}
        >
          {quote.URL ? (
            <a
              href={quote.URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                isRail
                  ? "transition-colors hover:text-foreground"
                  : "underline underline-offset-4 hover:opacity-80",
              )}
            >
              {quote.author}
            </a>
          ) : (
            quote.author
          )}
        </div>
      </CardContent>
    </Card>
  );
}
