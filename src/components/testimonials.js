import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Testimonials({}) {
  return (
    <div className="rounded-xl px-20 py-10">
      <div className="grid auto-cols-fr grid-flow-col grid-rows-2 gap-4">
        {testimonialData.map((testimony, index) => (
          <div
            key={index}
            className="max-w-fit rounded-2xl border-4 bg-white p-4 dark:bg-stone-950"
          >
            <div className="flex flex-row gap-2">
              <div className="flex items-center justify-center align-middle">
                <Avatar>
                  <AvatarImage src="https://github.com/shadcn.png" />
                  <AvatarFallback>CN</AvatarFallback>
                </Avatar>
              </div>
              <div className="flex-1">
                <div className="text-lg">{testimony.name}</div>
                <div className="text-sm text-muted-foreground">
                  {testimony.description}
                </div>
                <div className="text-pretty">{testimony.comment}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* <div>Please tell us what you think.</div> */}
    </div>
  );
}

const testimonialData = [
  {
    name: "Manny",
    description: "Online commenter, 25.",
    comment:
      "Just wanted to say this is such a cool site! exactly what I was looking for and very well put together.",
  },
  {
    name: "Alex P",
    description: "21, guy on Telegram.",
    comment: "This is sick. I love simple clean stuff like this.",
  },
  {
    name: "Stacey",
    description: "32, gym enthusiast.",
    comment: "I feel like I'm getting rewarded for going to the gym.",
  },
  {
    name: "Brian",
    description: "40, lifter.",
    comment: "The instant visualizer is incredibly motivating.",
  },
  {
    name: "Mac",
    description: "23, novice.",
    comment: "Love this.",
  },
  {
    name: "John",
    description: "37, ex-runner.",
    comment: "I've never seen my strength progress so clearly.",
  },
  {
    name: "Hong",
    description: "31, lifter.",
    comment: "I finally crushed my PRs with accurate insights!.",
  },
];
