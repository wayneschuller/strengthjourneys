import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut } from "lucide-react";
import { SidePanelSelectLiftsButton } from "@/components/side-panel-lift-chooser";

export function VisualizerChartControls({
  chartRef,
  xScaleMin,
  xScaleMax,
  firstDate,
  xZoomPan,
  setXZoomPan,
}) {
  return (
    <div className="hidden flex-row gap-4 md:flex">
      <Button
        variant="outline"
        onClick={(e) => {
          const chart = chartRef.current;
          if (chart) {
            if (setXZoomPan) setXZoomPan({ xMin: firstDate, xMax: xScaleMax });

            chart.zoomScale(
              "x",
              {
                min: firstDate,
                // max: lastDate,
                max: xScaleMax, // xScaleMax is lastDate with padding
              },
              "default",
            );
          }
        }}
      >
        Show All Time
      </Button>
      <Button
        variant="outline"
        onClick={(e) => {
          const chart = chartRef.current;
          if (chart) {
            chart.zoomScale(
              "x",
              {
                min: xScaleMin,
                max: xScaleMax,
              },
              "default",
            );
          }
        }}
      >
        Show Recent
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={(e) => {
          const chart = chartRef.current;
          if (chart) chart.zoom(0.5, "default");
        }}
      >
        <ZoomOut />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={(e) => {
          const chart = chartRef.current;
          if (chart) chart.zoom(1.5, "default");
        }}
      >
        <ZoomIn />
      </Button>
      <SidePanelSelectLiftsButton />
    </div>
  );
}
