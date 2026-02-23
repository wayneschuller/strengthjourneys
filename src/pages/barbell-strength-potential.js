
import { useSession } from "next-auth/react";
import { NextSeo } from "next-seo";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { ChooseSheetInstructionsCard } from "@/components/instructions-cards";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { BIG_FOUR_LIFT_TYPES } from "@/lib/processing-utils";
import { RelatedArticles } from "@/components/article-cards";
import { useLocalStorage } from "usehooks-ts";
import { E1RMFormulaRadioGroup } from "@/components/e1rm-formula-radio-group";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import {
  PageContainer,
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
} from "@/components/page-header";
import { StrengthPotentialBarChart } from "@/components/visualizer/strength-potential-bar-chart";

import { ChartColumnDecreasing, ChevronDown } from "lucide-react";

import { fetchRelatedArticles } from "@/lib/sanity-io.js";
import { useMemo, useState } from "react";

export async function getStaticProps() {
  const RELATED_ARTICLES_CATEGORY = "Personal Record Analyzer";
  const relatedArticles = await fetchRelatedArticles(RELATED_ARTICLES_CATEGORY);

  return {
    props: {
      relatedArticles,
    },
    revalidate: 60 * 60,
  };
}

/**
 * Barbell Strength Potential page. Renders SEO metadata and delegates rendering to StrengthPotentialMain.
 * @param {Object} props
 * @param {Array} props.relatedArticles - CMS articles related to the PR Analyzer topic, fetched via ISR.
 */
export default function StrengthPotential({ relatedArticles }) {
  // OG Meta Tags
  const description =
    "Unlock free insights into your strength training with the barbell strength potential charts. Track PRs and discover untapped PRs across rep schemes.";
  const title = "Barbell Strength Potential | Strength Journeys";
  const canonicalURL =
    "https://www.strengthjourneys.xyz/barbell-strength-potential";
  const ogImageURL =
    "https://www.strengthjourneys.xyz/strength_journeys_barbell_strength_potential_og.png";
  const keywords =
    "strength training, PR analyzer, workout progress, potential strength, lifting journey, strength gains, personal records, strength progress reports, fitness data visualization";

  return (
    <>
      <NextSeo
        title={title}
        description={description}
        canonical={canonicalURL}
        openGraph={{
          url: canonicalURL,
          title: title,
          description: description,
          type: "website",
          images: [
            {
              url: ogImageURL,
              alt: "Strength Journeys Barbell Strength Potential",
            },
          ],
          site_name: "Strength Journeys",
        }}
        twitter={{
          handle: "@wayneschuller",
          site: "@wayneschuller",
          cardType: "summary_large_image",
        }}
        additionalMetaTags={[
          {
            name: "keywords",
            content: keywords,
          },
        ]}
      />
      {/* Keep the main component separate. I learned the hard way if it breaks server rendering you lose static metadata tags */}
      <StrengthPotentialMain relatedArticles={relatedArticles} />
    </>
  );
}

/**
 * Inner client component for the Barbell Strength Potential page. Renders E1RM formula selector and
 * bar charts of top lifts per rep range for the Big Four plus a user-selected additional lift.
 * @param {Object} props
 * @param {Array} props.relatedArticles - CMS articles to display in the related articles section.
 */
function StrengthPotentialMain({ relatedArticles }) {
  const { data: session, status: authStatus } = useSession();
  const { liftTypes, isLoading, sheetInfo } = useUserLiftingData();
  const [e1rmFormula, setE1rmFormula] = useLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, "Brzycki", {
    initializeWithValue: false,
  });
  const [selectedOtherLift, setSelectedOtherLift] = useState("");
  const [openOtherLift, setOpenOtherLift] = useState(false);

  // Big four: only those the user has data for (canonical order from BIG_FOUR_LIFT_TYPES)
  const bigFourToShow = useMemo(() => {
    if (!liftTypes?.length) return [];
    return BIG_FOUR_LIFT_TYPES.filter((name) =>
      liftTypes.some((l) => l.liftType === name)
    );
  }, [liftTypes]);

  // Other lifts (not in big four), by popularity
  const otherLiftTypes = useMemo(() => {
    if (!liftTypes?.length) return [];
    return liftTypes
      .filter((l) => !BIG_FOUR_LIFT_TYPES.includes(l.liftType))
      .map((l) => l.liftType);
  }, [liftTypes]);

  const displayOtherLift = selectedOtherLift || otherLiftTypes[0] || null;

  if (!isLoading && authStatus === "authenticated" && !sheetInfo?.ssid)
    return (
      <div className="mt-5 flex flex-1 flex-row justify-center align-middle md:mt-10">
        <ChooseSheetInstructionsCard session={session} />
      </div>
    );

  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderHeading icon={ChartColumnDecreasing}>
          Barbell Strength Potential
        </PageHeaderHeading>
        <PageHeaderDescription>
          Review your strength potential with bar charts showcasing your top
          lifts across rep ranges, highlighting untapped gains to help you find
          new personal records to feed that desperate hunger for validation.
        </PageHeaderDescription>
        <div className="md:max-w-md">
          <E1RMFormulaRadioGroup
            e1rmFormula={e1rmFormula}
            setE1rmFormula={setE1rmFormula}
            horizontal={true}
          />
        </div>
      </PageHeader>
      <section className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {bigFourToShow.map((liftType) => (
          <StrengthPotentialBarChart key={liftType} liftType={liftType} />
        ))}
      </section>
      {otherLiftTypes.length > 0 && (
        <section className="mt-8">
          <div className="mb-4 flex flex-col gap-2 px-4 sm:px-0 sm:flex-row sm:items-center">
            <label htmlFor="other-lift-combobox" className="text-base font-semibold text-foreground">
              View another lift
            </label>
            <Popover open={openOtherLift} onOpenChange={setOpenOtherLift}>
              <PopoverTrigger asChild>
                <Button
                  id="other-lift-combobox"
                  variant="outline"
                  role="combobox"
                  aria-expanded={openOtherLift}
                  className="h-10 w-full justify-between font-normal sm:w-[280px]"
                >
                  {displayOtherLift || "Choose a lift"}
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search lifts..." />
                  <CommandList>
                    <CommandEmpty>No lift found.</CommandEmpty>
                    <CommandGroup>
                      {otherLiftTypes.map((liftType) => (
                        <CommandItem
                          key={liftType}
                          value={liftType}
                          onSelect={() => {
                            setSelectedOtherLift(liftType);
                            setOpenOtherLift(false);
                          }}
                        >
                          {liftType}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          {displayOtherLift && (
            <div className="mx-auto max-w-4xl">
              <StrengthPotentialBarChart key={displayOtherLift} liftType={displayOtherLift} />
            </div>
          )}
        </section>
      )}
      <RelatedArticles articles={relatedArticles} />
    </PageContainer>
  );
}
