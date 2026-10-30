// pages/strength-hexagon-lab.js
//
// A workbench for the strength hexagon: the big four lifts and pull-ups drawn
// as one shareable shape. Three renderings of the same scores sit side by side so
// we can judge which one makes an athlete want to post it: a WebGL hologram,
// a WebGL crystal, and a print-magazine editorial chart. Scores are entered
// directly as percentiles here; wiring them to real lifts comes once a look
// is chosen. Noindex while it is an experiment.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { NextSeo } from "next-seo";
import { Download, Hexagon, Share2 } from "lucide-react";

import {
  PageContainer,
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header";
import {
  AGE_GROUPS,
  HEXAGON_AXES,
  HEXAGON_PALETTES,
  HEXAGON_PRESETS,
  archetypeFor,
  headlineFor,
} from "@/components/strength-hexagon/hexagon-model";
import { renderStoryCardBlob } from "@/components/strength-hexagon/hexagon-story-card";
import {
  EDITORIAL_THEME,
  StrengthHexagonEditorial,
} from "@/components/strength-hexagon/strength-hexagon-editorial";
import { StrengthHexagonWebGL } from "@/components/strength-hexagon/strength-hexagon-webgl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { canNativeShareFiles, downloadBlob } from "@/lib/recap-share-image";
import { cn } from "@/lib/utils";

const VARIANTS = [
  { id: "hologram", label: "Hologram" },
  { id: "crystal", label: "Crystal" },
  { id: "editorial", label: "Editorial" },
];

const SERIF = "'Fraunces Variable', Georgia, serif";
const CONDENSED = "'IBM Plex Sans Condensed', sans-serif";

export default function StrengthHexagonLabPage() {
  return (
    <PageContainer>
      <NextSeo
        title="Strength Hexagon Lab | Strength Journeys"
        noindex
        nofollow
      />
      <PageHeader>
        <PageHeaderHeading icon={Hexagon}>
          Strength Hexagon Lab
        </PageHeaderHeading>
        <PageHeaderDescription>
          The big four lifts and pull-ups drawn as one shape. Try each look,
          drag the 3D ones to spin them, and save a story card to see how it
          posts.
        </PageHeaderDescription>
      </PageHeader>
      <HexagonLab />
    </PageContainer>
  );
}

function HexagonLab() {
  const [variant, setVariant] = useState("hologram");
  const [values, setValues] = useState(HEXAGON_PRESETS[0].values);
  const [paletteId, setPaletteId] = useState("ember");
  const [ageGroup, setAgeGroup] = useState("40s");
  const [storyFrame, setStoryFrame] = useState(true);
  const [webglUnsupported, setWebglUnsupported] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [exporting, setExporting] = useState(false);
  const visualRef = useRef(null);

  useEffect(() => {
    setCanShare(canNativeShareFiles());
  }, []);

  const palette = HEXAGON_PALETTES[paletteId];
  const effectiveVariant =
    webglUnsupported && variant !== "editorial" ? "editorial" : variant;
  const isEditorial = effectiveVariant === "editorial";
  const title = archetypeFor(values);
  const headline = headlineFor(values, ageGroup);
  const handleUnsupported = useCallback(() => setWebglUnsupported(true), []);

  const theme = useMemo(
    () =>
      isEditorial
        ? {
            bg: EDITORIAL_THEME.bg,
            text: EDITORIAL_THEME.ink,
            muted: EDITORIAL_THEME.muted,
            glow: null,
          }
        : {
            bg: palette.css.bg,
            text: "#ffffff",
            muted: "rgba(255,255,255,0.62)",
            glow: palette.css.core,
          },
    [isEditorial, palette],
  );

  const setAxisValue = (index, value) =>
    setValues((previous) =>
      previous.map((entry, i) => (i === index ? value : entry)),
    );

  const makeCard = async () => {
    const capture = await visualRef.current?.capture();
    if (!capture) return null;
    return renderStoryCardBlob({ capture, theme, title, headline });
  };

  const handleSave = async () => {
    setExporting(true);
    try {
      const blob = await makeCard();
      if (blob) downloadBlob(blob, "strength-hexagon.png");
    } finally {
      setExporting(false);
    }
  };

  const handleShare = async () => {
    setExporting(true);
    try {
      const blob = await makeCard();
      if (!blob) return;
      const file = new File([blob], "strength-hexagon.png", {
        type: "image/png",
      });
      await navigator.share({ files: [file], title });
    } catch {
      // A dismissed share sheet rejects; nothing to do.
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex flex-col items-center gap-4">
        <Tabs value={effectiveVariant} onValueChange={setVariant}>
          <TabsList>
            {VARIANTS.map(({ id, label }) => (
              <TabsTrigger
                key={id}
                value={id}
                disabled={webglUnsupported && id !== "editorial"}
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div
          className={cn(
            "relative flex w-full flex-col items-center overflow-hidden rounded-3xl shadow-2xl transition-[max-width] duration-500",
            storyFrame ? "aspect-[9/16] max-w-[440px]" : "max-w-[680px]",
          )}
          style={{ background: theme.bg }}
        >
          {!isEditorial && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(circle at 50% 48%, ${palette.css.core}2e, transparent 62%)`,
              }}
            />
          )}
          <div className="relative flex w-full flex-1 flex-col items-center justify-center px-4 py-8">
            <p
              className="text-sm"
              style={{ color: theme.muted, fontFamily: CONDENSED }}
            >
              My strength profile
            </p>
            <h2
              className="mt-1 text-center text-3xl font-semibold sm:text-4xl"
              style={{
                color: theme.text,
                fontFamily: SERIF,
                textShadow: theme.glow
                  ? `0 0 18px ${theme.glow}, 0 0 42px ${theme.glow}55`
                  : "none",
              }}
            >
              {title}
            </h2>

            <div className="my-4 w-full">
              {isEditorial ? (
                <StrengthHexagonEditorial
                  ref={visualRef}
                  values={values}
                  palette={palette}
                />
              ) : (
                <StrengthHexagonWebGL
                  key={effectiveVariant}
                  ref={visualRef}
                  variant={effectiveVariant}
                  values={values}
                  palette={palette}
                  onUnsupported={handleUnsupported}
                  className="[&>canvas]:[mask-image:radial-gradient(circle_closest-side,#000_74%,transparent_100%)]"
                />
              )}
            </div>

            <p
              className="text-center text-lg sm:text-xl"
              style={{ color: theme.text, fontFamily: CONDENSED }}
            >
              {headline}
            </p>
            <p
              className="mt-3 text-xs"
              style={{ color: theme.muted, fontFamily: CONDENSED }}
            >
              strengthjourneys.xyz
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={handleSave} disabled={exporting}>
            <Download className="mr-2 h-4 w-4" />
            Save story card
          </Button>
          {canShare && (
            <Button
              variant="outline"
              onClick={handleShare}
              disabled={exporting}
            >
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          )}
        </div>
      </div>

      <Card className="h-fit">
        <CardContent className="flex flex-col gap-6 pt-6">
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Athletes</h3>
            <div className="flex flex-wrap gap-2">
              {HEXAGON_PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  size="sm"
                  variant="outline"
                  onClick={() => setValues(preset.values)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Palette</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(HEXAGON_PALETTES).map(([id, entry]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPaletteId(id)}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors",
                    id === paletteId
                      ? "border-foreground"
                      : "border-border hover:border-foreground/50",
                  )}
                >
                  <span
                    aria-hidden
                    className="h-3.5 w-3.5 rounded-full"
                    style={{
                      background: `linear-gradient(135deg, ${entry.css.edge}, ${entry.css.core}, ${entry.css.accent})`,
                    }}
                  />
                  {entry.label}
                </button>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Compared with athletes</h3>
            <div className="flex flex-wrap gap-2">
              {AGE_GROUPS.map((group) => (
                <Button
                  key={group.id}
                  size="sm"
                  variant={group.id === ageGroup ? "default" : "outline"}
                  onClick={() => setAgeGroup(group.id)}
                >
                  {group.label}
                </Button>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold">Percentile per axis</h3>
            {HEXAGON_AXES.map((axis, index) => {
              const value = values[index];
              const tested = value != null;
              return (
                <div key={axis.key} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      <span className="font-medium">{axis.label}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {axis.lift}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground w-8 text-right tabular-nums">
                        {tested ? value : ""}
                      </span>
                      <Switch
                        checked={tested}
                        aria-label={`${axis.label} tested`}
                        onCheckedChange={(checked) =>
                          setAxisValue(index, checked ? 50 : null)
                        }
                      />
                    </span>
                  </div>
                  <Slider
                    aria-label={`${axis.label} percentile`}
                    min={0}
                    max={100}
                    step={1}
                    disabled={!tested}
                    value={[value ?? 0]}
                    onValueChange={([next]) => setAxisValue(index, next)}
                  />
                </div>
              );
            })}
          </section>

          <label className="flex items-center justify-between gap-2 text-sm">
            Frame as a story card
            <Switch checked={storyFrame} onCheckedChange={setStoryFrame} />
          </label>
        </CardContent>
      </Card>
    </div>
  );
}
