// pages/articles/iron-and-the-soul.jsx

// The copyright of this article is owned by Henry Rollins.

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Head from "next/head";
const title = "The Iron and the Soul";

export default function Article() {
  return (
    <div className="mx-4 mb-10 flex items-center justify-center">
      <Head>
        <title>{title}</title>
        <meta name="description" content={title} />
      </Head>
      <Card className="shadow-lg shadow-primary-foreground ring-0 ring-black hover:ring-1 dark:ring-white">
        <CardHeader></CardHeader>
        <CardContent>
          <IronAndTheSoul />
        </CardContent>
      </Card>
    </div>
  );
}

function IronAndTheSoul() {
  return (
    <article className="prose prose-orange dark:prose-invert">
      <header>
        <h1>{title}</h1>
        <h2>
          by <a href="https://www.henryrollins.com/">Henry Rollins</a>
        </h2>
      </header>
      <p>
        I believe that the definition of definition is reinvention. To not be
        like your parents. To not be like your friends. To be yourself.
        Completely.
      </p>
      <p>
        When I was young I had no sense of myself. All I was, was a product of
        all the fear and humiliation I suffered. Fear of my parents. The
        humiliation of teachers calling me “garbage can” and telling me I’d be
        mowing lawns for a living. And the very real terror of my fellow
        students. I was threatened and beaten up for the color of my skin and my
        size. I was skinny and clumsy, and when others would tease me I didn’t
        run home crying, wondering why.
      </p>
      <p>
        I knew all too well. I was there to be antagonized. In sports I was
        laughed at. A spaz. I was pretty good at boxing but only because the
        rage that filled my every waking moment made me wild and unpredictable.
        I fought with some strange fury. The other boys thought I was crazy.
      </p>
      <p>I hated myself all the time.</p>
      <p>
        As stupid at it seems now, I wanted to talk like them, dress like them,
        carry myself with the ease of knowing that I wasn’t going to get pounded
        in the hallway between classes. Years passed and I learned to keep it
        all inside. I only talked to a few boys in my grade. Other losers. Some
        of them are to this day the greatest people I have ever known. Hang out
        with a guy who has had his head flushed down a toilet a few times, treat
        him with respect, and you’ll find a faithful friend forever. But even
        with friends, school sucked. Teachers gave me hard time.
      </p>
      <p>I didn’t think much of them either.</p>
      <p>
        Then came Mr. Pepperman, my advisor. He was a powerfully built Vietnam
        veteran, and he was scary. No one ever talked out of turn in his class.
        Once one kid did and Mr. P. lifted him off the ground and pinned him to
        the black board. Mr. P. could see that I was in bad shape, and one
        Friday in October he asked me if I had ever worked out with weights. I
        told him no.
      </p>
      <p>
        He told me that I was going to take some of the money that I had saved
        and buy a hundred pound set of weights at Sears. As I left his office, I
        started to think of things I would say to him on Monday when he asked
        about the weights that I was not going to buy. Still, it made me feel
        special. My father never really got that close to caring. On Saturday I
        bought the weights, but I couldn’t even drag them to my mom’s car. An
        attendant laughed at me as he put them on a dolly.
      </p>
      <p>
        Monday came and I was called into Mr. P.’s office after school. He said
        that he was going to show me how to work out. He was going to put me on
        a program and start hitting me in the solar plexus in the hallway when I
        wasn’t looking. When I could take the punch we would know that we were
        getting somewhere. At no time was I to look at myself in the mirror or
        tell anyone at school what I was doing. In the gym he showed me ten
        basic exercises. I paid more attention than I ever did in any of my
        classes. I didn’t want to blow it. I went home that night and started
        right in.
      </p>
      <p>
        Weeks passed, and every once in a while Mr. P. would give me a shot and
        drop me in the hallway, sending my books flying. The other students
        didn’t know what to think. More weeks passed, and I was steadily adding
        new weights to the bar. I could sense the power inside my body growing.
        I could feel it.
      </p>
      <p>
        Right before Christmas break I was walking to class, and from out of
        nowhere Mr. Pepperman appeared and gave me a shot in the chest. I
        laughed and kept going. He said I could look at myself now. I got home
        and ran to the bathroom and pulled off my shirt. I saw a body, not just
        the shell that housed my stomach and my heart. My biceps bulged. My
        chest had definition. I felt strong. It was the first time I can
        remember having a sense of myself. I had done something and no one could
        ever take it away.
      </p>
      <p>You couldn’t say shit to me.</p>
      <p>
        It took me years to fully appreciate the value of the lessons I have
        learned from the Iron. I used to think that it was my adversary, that I
        was trying to lift that which does not want to be lifted. I was wrong.
        When the Iron doesn’t want to come off the mat, it’s the kindest thing
        it can do for you. If it flew up and went through the ceiling, it
        wouldn’t teach you anything. That’s the way the Iron talks to you. It
        tells you that the material you work with is that which you will come to
        resemble.
      </p>
      <p>That which you work against will always work against you.</p>
      <p>
        It wasn’t until my late twenties that I learned that by working out I
        had given myself a great gift. I learned that nothing good comes without
        work and a certain amount of pain. When I finish a set that leaves me
        shaking, I know more about myself. When something gets bad, I know it
        can’t be as bad as that workout.
      </p>
      <p>
        I used to fight the pain, but recently this became clear to me: pain is
        not my enemy; it is my call to greatness. But when dealing with the
        Iron, one must be careful to interpret the pain correctly. Most injuries
        involving the Iron come from ego. I once spent a few weeks lifting
        weight that my body wasn’t ready for and spent a few months not picking
        up anything heavier than a fork. Try to lift what you’re not prepared to
        and the Iron will teach you a little lesson in restraint and
        self-control.
      </p>
      <p>
        I have never met a truly strong person who didn’t have self-respect. I
        think a lot of inwardly and outwardly directed contempt passes itself
        off as self-respect: the idea of raising yourself by stepping on
        someone’s shoulders instead of doing it yourself. When I see guys
        working out for cosmetic reasons, I see vanity exposing them in the
        worst way, as cartoon characters, billboards for imbalance and
        insecurity. Strength reveals itself through character. It is the
        difference between bouncers who get off strong-arming people and Mr.
        Pepperman.
      </p>
      <p>
        Muscle mass does not always equal strength. Strength is kindness and
        sensitivity. Strength is understanding that your power is both physical
        and emotional. That it comes from the body and the mind. And the heart.
      </p>
      <p>
        Yukio Mishima said that he could not entertain the idea of romance if he
        was not strong. Romance is such a strong and overwhelming passion, a
        weakened body cannot sustain it for long. I have some of my most
        romantic thoughts when I am with the Iron. Once I was in love with a
        woman. I thought about her the most when the pain from a workout was
        racing through my body.
      </p>
      <p>
        Everything in me wanted her. So much so that sex was only a fraction of
        my total desire. It was the single most intense love I have ever felt,
        but she lived far away and I didn’t see her very often. Working out was
        a healthy way of dealing with the loneliness. To this day, when I work
        out I usually listen to ballads.
      </p>
      <p>I prefer to work out alone.</p>
      <p>
        It enables me to concentrate on the lessons that the Iron has for me.
        Learning about what you’re made of is always time well spent, and I have
        found no better teacher. The Iron had taught me how to live. Life is
        capable of driving you out of your mind. The way it all comes down these
        days, it’s some kind of miracle if you’re not insane. People have become
        separated from their bodies. They are no longer whole.
      </p>
      <p>
        I see them move from their offices to their cars and on to their
        suburban homes. They stress out constantly, they lose sleep, they eat
        badly. And they behave badly. Their egos run wild; they become motivated
        by that which will eventually give them a massive stroke. They need the
        Iron Mind.
      </p>
      <p>
        Through the years, I have combined meditation, action, and the Iron into
        a single strength. I believe that when the body is strong, the mind
        thinks strong thoughts. Time spent away from the Iron makes my mind
        degenerate. I wallow in a thick depression. My body shuts down my mind.
      </p>
      <p>
        The Iron is the best antidepressant I have ever found. There is no
        better way to fight weakness than with strength. Once the mind and body
        have been awakened to their true potential, it’s impossible to turn
        back.
      </p>
      <p>
        The Iron never lies to you. You can walk outside and listen to all kinds
        of talk, get told that you’re a god or a total bastard. The Iron will
        always kick you the real deal. The Iron is the great reference point,
        the all-knowing perspective giver. Always there like a beacon in the
        pitch black. I have found the Iron to be my greatest friend. It never
        freaks out on me, never runs. Friends may come and go. But two hundred
        pounds is always two hundred pounds.
      </p>
      <footer>
        <i>This article originally appeared in Details Magazine in 1994.</i>
        <p>
          <a href="https://www.henryrollins.com/">
            Henry Rollins official website.
          </a>
        </p>
        <p>
          <a href="https://www.amazon.com/s?k=henry+rollins">
            Buy Henry Rollins books on Amazon
          </a>
        </p>
      </footer>
    </article>
  );
}
