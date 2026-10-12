import { cn } from "@/lib/utils";
import { devLog } from "@/lib/processing-utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Marquee from "@/components/magicui/marquee";
import {
  ThumbsUp,
  Star,
  Heart,
  Smile,
  CheckCircle,
  Trophy,
  Gift,
  Sun,
  MessageCircle,
  Award,
} from "lucide-react";

/**
 * Dual-row marquee carousel displaying user testimonial cards.
 * The two rows scroll in opposite directions and pause on hover.
 */
export function Testimonials({}) {
  const firstRow = testimonialData.slice(0, testimonialData.length / 2);
  const secondRow = testimonialData.slice(testimonialData.length / 2);

  return (
    <div className="relative flex w-full flex-col items-center justify-center overflow-hidden">
      {/* <div className="grid auto-cols-fr grid-flow-col grid-rows-2 gap-4"> */}
      <Marquee pauseOnHover className="[--duration:20s]">
        {firstRow.map((testimony, index) => (
          <TestimonialCard key={index} testimony={testimony} />
        ))}
      </Marquee>
      <Marquee reverse pauseOnHover className="[--duration:20s]">
        {secondRow.map((testimony, index) => (
          <TestimonialCard key={index} testimony={testimony} />
        ))}
      </Marquee>
      <div className="from-card pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r" />
      <div className="from-card pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l" />
      {/* <div>Please tell us what you think.</div> */}
    </div>
  );
}

// Internal card that displays a single testimonial with avatar, name, description, and quoted comment.
function TestimonialCard({ testimony }) {
  // devLog(testimony);
  return (
    <figure
      className={cn(
        "max-w-[25rem] justify-center rounded-2xl border-2 p-4 align-middle",
      )}
    >
      <div className="flex flex-row gap-2">
        <div className="flex flex-col items-center justify-start">
          <Avatar>
            <AvatarImage src={testimony.avatarUrl} alt={`${testimony.name}`} />
            {testimony.icon && (
              <AvatarFallback className="text-secondary-foreground">
                {<testimony.icon />}
              </AvatarFallback>
            )}
            {/* <AvatarFallback></AvatarFallback> */}
          </Avatar>
        </div>
        <div className="flex-1">
          <figcaption className="text-lg">{testimony.name}</figcaption>
          <div className="text-muted-foreground text-sm">
            {testimony.description}
          </div>
          <blockquote className="text-pretty">{testimony.comment}</blockquote>
        </div>
      </div>
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
    icon: Trophy,
  },
  {
    name: "Manny",
    description: "Online commenter, 25.",
    comment:
      "Just wanted to say this is such a cool site! exactly what I was looking for and very well put together.",
    icon: Award,
  },
  {
    name: "Paul",
    description: "Big four lifter.",
    comment:
      "Great job on the website. I like the calculators, they're good for setting targets.",
    icon: CheckCircle,
  },
  {
    name: "Stacey",
    description: "32, gym enthusiast.",
    comment: "I feel like I'm getting rewarded for going to the gym.",
    icon: ThumbsUp,
    avatarUrl: "/avatars/avatar_stacey.jpg",
  },
  {
    name: "Jason",
    description: "Lifter and runner.",
    comment:
      "I'm enjoying the app, and I've noticed all the work going into it. It's great!",
    icon: Smile,
  },
  {
    name: "Mac",
    description: "23, novice.",
    comment: "Love this.",
    avatarUrl: "/avatars/avatar_mac.jpg",
    icon: Heart,
  },
  {
    name: "Chris",
    description: "54, returning lifter.",
    comment:
      "An amazing resource for any level of lifter. The site has a very professional, well-organized look that inspires confidence. I look forward to logging my lifts here for a long time.",
    icon: Star,
  },
  {
    name: "Alex P",
    description: "21, guy on Telegram.",
    comment: "This is sick. I love simple clean stuff like this.",
    icon: Star,
  },
  {
    name: "Hadi",
    description: "Lifter, introduced by a coach.",
    comment:
      "I really liked this site from the start. My coach showed it to us to track our progress and see our milestones. I especially like the 1,000 lb total.",
    icon: Sun,
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
    icon: MessageCircle,
  },
  {
    name: "Poet",
    description: "Lifter.",
    comment: "I like that your service is free to use.",
    icon: Gift,
  },
];
