/** @format */

// Carefully scrub our data internals before we nullify them in React state
// FIXME: I'm not sure this is needed
export default function scrubData(
  parsedData,
  setParsedData,
  visualizerData,
  setVisualizerData,
  analyzerData,
  setAnalyzerData
) {
  console.log(`scrubData()...`);

  if (parsedData) parsedData.splice(0, parsedData.length); // empty the array
  setParsedData(null);

  if (visualizerData?.visualizerE1RMLineData)
    visualizerData.visualizerE1RMLineData.forEach((liftType) => {
      liftType.data.splice(0, liftType.data.length); // empty the line data array for this lift type
    });

  if (visualizerData?.achievementAnnotations)
    for (let key in visualizerData.achievementAnnotations) {
      if (visualizerData.achievementAnnotations.hasOwnProperty(key)) {
        delete visualizerData.achievementAnnotations[key];
      }
    }
  setVisualizerData(null);

  if (analyzerData?.analyzerPieData) analyzerData.analyzerPieData.splice(0, analyzerData.analyzerPieData.length); // empty the array

  if (analyzerData?.analyzerPRCardData)
    for (let key in analyzerData.analyzerPRCardData) {
      if (analyzerData.analyzerPRCardData.hasOwnProperty(key)) {
        delete analyzerData.analyzerPRCardData[key];
      }
    }
  setAnalyzerData(null);
}
