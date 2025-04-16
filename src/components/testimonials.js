import { cn } from "@/lib/utils";
import { devLog } from "@/lib/processing-utils";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
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
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-white dark:from-background"></div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-white dark:from-background"></div>
      {/* <div>Please tell us what you think.</div> */}
    </div>
  );
}

function TestimonialCard({ testimony }) {
  // devLog(testimony);
  return (
    <figure
      className={cn(
        "max-w-[25rem] justify-center rounded-2xl border-2 p-4 align-middle",
        "bg-white hover:bg-stone-100",
        "dark:bg-stone-950 dark:hover:bg-stone-900",
      )}
    >
      <div className="flex flex-row gap-2">
        <div className="flex flex-col items-center justify-start">
          <Avatar>
            <AvatarImage src={testimony.avatarUrl} alt={`${testimony.name}`} />
            {testimony.icon && (
              <AvatarFallback>{<testimony.icon />}</AvatarFallback>
            )}
            {/* <AvatarFallback></AvatarFallback> */}
          </Avatar>
        </div>
        <div className="flex-1">
          <figcaption className="text-lg">{testimony.name}</figcaption>
          <div className="text-sm text-muted-foreground">
            {testimony.description}
          </div>
          <blockquote className="text-pretty">{testimony.comment}</blockquote>
        </div>
      </div>
    </figure>
  );
}

const testimonialData = [
  {
    name: "Hong",
    description: "31, lifter.",
    comment: "I finally crushed my PRs with accurate insights!",
    icon: ThumbsUp,
  },
  {
    name: "Manny",
    description: "Online commenter, 25.",
    comment:
      "Just wanted to say this is such a cool site! exactly what I was looking for and very well put together.",
    icon: Award,
  },
  {
    name: "Alex P",
    description: "21, guy on Telegram.",
    comment: "This is sick. I love simple clean stuff like this.",
    icon: Star,
  },
  {
    name: "Stacey",
    description: "32, gym enthusiast.",
    comment: "I feel like I'm getting rewarded for going to the gym.",
    icon: ThumbsUp,
    avatarUrl: "/avatars/avatar_stacey.jpg",
  },
  {
    name: "Brian",
    description: "40, lifter.",
    comment: "The instant visualizer is incredibly motivating.",
    icon: ThumbsUp,
  },
  {
    name: "Mac",
    description: "23, novice.",
    comment: "Love this.",
    avatarUrl: "/avatars/avatar_mac.jpg",
    icon: Heart,
  },
  {
    name: "John",
    description: "37, ex-runner.",
    comment: "I've never seen my strength progress so clearly.",
    icon: Gift,
  },
  {
    name: "Jerry S.",
    description: "32, powerlifter.",
    comment: "I trust putting my data into Google Sheets over other apps.",
    avatarUrl: "/avatars/avatar_jerry.jpg",
  },
];
