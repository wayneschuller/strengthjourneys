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

  parsedData.splice(0, parsedData.length); // empty the array
  setParsedData(null);

  if (visualizerData.visualizerE1RMLineData !== null)
    visualizerData.visualizerE1RMLineData.forEach((liftType) => {
      liftType.data.splice(0, liftType.data.length); // empty the line data array for this lift type
    });
  for (let key in visualizerData.achievementAnnotations) {
    if (visualizerData.achievementAnnotations.hasOwnProperty(key)) {
      delete visualizerData.achievementAnnotations[key];
    }
  }
  setVisualizerData(null);

  analyzerData.analyzerPieData.splice(0, analyzerData.analyzerPieData.length); // empty the array
  for (let key in analyzerData.analyzerPRCardData) {
    if (analyzerData.analyzerPRCardData.hasOwnProperty(key)) {
      delete analyzerData.analyzerPRCardData[key];
    }
  }
  setAnalyzerData(null);
}
