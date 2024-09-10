import { UnitChooser } from "@/components/unit-type-chooser";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocalStorage } from "usehooks-ts";
import { cn } from "@/lib/utils";

export function BioDetailsCard({
  age,
  setAge,
  bodyWeight,
  isMetric,
  toggleIsMetric,
  setBodyWeight,
  sex,
  setSex,
  height,
  setHeight,
  shareBioDetails,
  setShareBioDetails,
}) {
  return (
    <Card className="">
      <CardHeader>
        <CardTitle>Tell us about yourself</CardTitle>
        <CardDescription>
          Enhance the AI by providing your basic details
        </CardDescription>
      </CardHeader>
      <CardContent className="">
        <div className="group mb-5 flex flex-row space-x-2 align-middle">
          <Checkbox
            id="shareBioDetails"
            checked={shareBioDetails}
            onCheckedChange={setShareBioDetails}
            className="group-hover:border-blue-500"
          />
          <Label
            htmlFor="shareBioDetails"
            className="cursor-pointer text-sm font-medium leading-none group-hover:underline peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Share this with the AI
          </Label>
        </div>

        <div
          className={cn(
            "flex flex-col items-start gap-4 md:flex-col md:gap-8",
            !shareBioDetails && "text-muted-foreground/40",
          )}
        >
          <div className="flex w-full flex-col">
            <div className="py-2">
              <Label htmlFor="age" className="text-xl">
                Age: {age}
              </Label>
            </div>
            <Slider
              min={13}
              max={100}
              step={1}
              value={[age]}
              onValueChange={(values) => setAge(values[0])}
              className="mt-2 min-w-40 flex-1"
              aria-label="Age"
              aria-labelledby="age"
            />
          </div>
          <div className="flex h-[4rem] w-full flex-col justify-between">
            <div className="flex flex-row items-center">
              <Label htmlFor="weight" className="mr-2 text-xl">
                Bodyweight:
              </Label>
              <Label
                htmlFor="weight"
                className="mr-2 w-[3rem] text-right text-xl"
              >
                {bodyWeight}
              </Label>
              <UnitChooser
                isMetric={isMetric}
                onSwitchChange={toggleIsMetric}
              />
            </div>
            <Slider
              min={isMetric ? 40 : 100}
              max={isMetric ? 230 : 500}
              step={1}
              value={[bodyWeight]}
              onValueChange={(values) => setBodyWeight(values[0])}
              className="mt-2 min-w-40 flex-1"
              aria-label={`Bodyweight in ${isMetric ? "kilograms" : "pounds"} `}
            />
          </div>
          <div>
            <HeightWidget height={height} setHeight={setHeight} />
          </div>
          <div className="flex h-[4rem] w-40 grow-0 items-center space-x-2">
            <Label htmlFor="sex" className="text-xl">
              Sex:
            </Label>
            <Select
              id="gender"
              value={sex}
              onValueChange={(value) => setSex(value)}
              className="min-w-52 text-xl"
            >
              <SelectTrigger aria-label="Select sex">
                <SelectValue placeholder="Select sex" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
      {/* <CardFooter className="text-sm"></CardFooter> */}
    </Card>
  );
}

const HeightWidget = ({ height, setHeight }) => {
  const handleHeightChange = (newHeight) => {
    setHeight(newHeight[0]);
  };

  const cmToFeetInches = (cm) => {
    const inches = cm / 2.54;
    const feet = Math.floor(inches / 12);
    const remainingInches = Math.round(inches % 12);
    return `${feet}'${remainingInches}"`;
  };

  return (
    <div className="flex w-96 flex-col align-middle">
      <div className="mb-2 flex flex-row gap-2 align-middle">
        <Label htmlFor="height" className="flex flex-row gap-3 text-xl">
          Height:
          <div className="">{height}cm</div>
          <div className="">{cmToFeetInches(height)}</div>
        </Label>
      </div>
      <Slider
        min={100}
        max={250}
        step={1}
        value={[height]}
        onValueChange={handleHeightChange}
        className="flex-grow"
      />
    </div>
  );
};
