import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Marquee from "@/components/magicui/marquee";
import { Quote } from "lucide-react";

/**
 * Dual-row marquee carousel displaying user testimonial cards.
 * The two rows scroll in opposite directions and pause on hover.
 */
export function Testimonials({}) {
  const firstRow = testimonialData.slice(0, testimonialData.length / 2);
  const secondRow = testimonialData.slice(testimonialData.length / 2);

  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold">💬 What Lifters Say</h2>
      {/* The mask fades both edges without needing to know the page background. */}
      <div className="relative mt-4 flex w-full flex-col overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
        <Marquee pauseOnHover repeat={3} className="[--duration:70s]">
          {firstRow.map((testimony) => (
            <TestimonialCard key={testimony.name} testimony={testimony} />
          ))}
        </Marquee>
        <Marquee reverse pauseOnHover repeat={3} className="[--duration:80s]">
          {secondRow.map((testimony) => (
            <TestimonialCard key={testimony.name} testimony={testimony} />
          ))}
        </Marquee>
      </div>
    </section>
  );
}

// Internal card that leads with the quoted comment, then the avatar, name, and description.
function TestimonialCard({ testimony }) {
  // Cards size to their quote, so short ones read as small punchy tiles between the wide ones.
  const isShort = testimony.comment.length < 70;

  return (
    <figure className="bg-card text-card-foreground hover:border-primary/40 flex w-max max-w-72 min-w-52 flex-col gap-4 rounded-xl border p-5 shadow-sm transition-colors sm:max-w-[26rem]">
      <Quote
        className="text-primary/30 size-6 shrink-0 fill-current"
        aria-hidden="true"
      />
      <blockquote
        className={cn(
          "text-pretty",
          isShort
            ? "text-xl leading-snug font-medium"
            : "text-base leading-relaxed",
        )}
      >
        {testimony.comment}
      </blockquote>
      <figcaption className="mt-auto flex items-center gap-3 border-t pt-4">
        <Avatar className="size-10">
          <AvatarImage src={testimony.avatarUrl} alt="" />
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
            {testimony.name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="leading-tight font-medium">{testimony.name}</div>
          <div className="text-muted-foreground text-sm">
            {testimony.description}
          </div>
        </div>
      </figcaption>
    </figure>
  );
}

// Real comments from lifters, lightly paraphrased, first names only.
const testimonialData = [
  {
    name: "Emily",
    description: "Lifter chasing plate milestones.",
    comment:
      "I thought I'd accidentally signed up for a free trial of something. The analytics and visualizations are so much better than what you get with Hevy and Strong, even as a paid user.",
  },
  {
    name: "Manny",
    description: "Online commenter, 25.",
    comment:
      "Just wanted to say this is such a cool site! exactly what I was looking for and very well put together.",
  },
  {
    name: "Paul",
    description: "Big four lifter.",
    comment:
      "Great job on the website. I like the calculators, they're good for setting targets.",
  },
  {
    name: "Stacey",
    description: "32, gym enthusiast.",
    comment: "I feel like I'm getting rewarded for going to the gym.",
    avatarUrl: "/avatars/avatar_stacey.jpg",
  },
  {
    name: "Jason",
    description: "Lifter and runner.",
    comment:
      "I'm enjoying the app, and I've noticed all the work going into it. It's great!",
  },
  {
    name: "Mac",
    description: "23, novice.",
    comment: "Love this.",
    avatarUrl: "/avatars/avatar_mac.jpg",
  },
  {
    name: "Chris",
    description: "54, returning lifter.",
    comment:
      "An amazing resource for any level of lifter. The site has a very professional, well-organized look that inspires confidence. I look forward to logging my lifts here for a long time.",
  },
  {
    name: "Alex P",
    description: "21, guy on Telegram.",
    comment: "This is sick. I love simple clean stuff like this.",
  },
  {
    name: "Hadi",
    description: "Lifter, introduced by a coach.",
    comment:
      "I really liked this site from the start. My coach showed it to us to track our progress and see our milestones. I especially like the 1,000 lb total.",
  },
  {
    name: "Jerry S.",
    description: "32, powerlifter.",
    comment: "I trust putting my data into Google Sheets over other apps.",
    avatarUrl: "/avatars/avatar_jerry.jpg",
  },
  {
    name: "Michael",
    description: "CrossFit athlete.",
    comment:
      "Our CrossFit gym switched apps and I wanted a way to clearly see my history. This is pretty good at that.",
  },
  {
    name: "Poet",
    description: "Lifter.",
    comment: "I like that your service is free to use.",
  },
];
