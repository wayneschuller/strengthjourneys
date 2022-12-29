// readData.js
// Wayne Schuller, wayne@schuller.id.au
// Licenced under https://www.gnu.org/licenses/gpl-3.0.html
//
// Utility functions for reading raw lift data
//
// Two main sources:
//  - google sheets api
//  - local CSV upload
//
// In the future we could support another spreadsheet or fitness app API


// FIXME: We had loadGSheetData here but it got merged over into a useEffect in appBar.js


// Callback function for html upload file button
// Use Papaparse to process whatever file is given via the html file picker
function readCSV(context) {
  // const reader = new FileReader();

  // reader.onload = function () {
    // const data = Papa.parse(reader.result, { dynamicTyping: true });

    // More than 10 errors might indicate it's a jpg or something non CSV
    // if (data.meta.aborted || data.errors.length > 10) {
      // console.error("Papaparse detected too many errors in file input. Do you even lift?");
      // return null;
    // }

    // Are we loading over an existing chart?
    // This is either a refresh or a concatenation event
    // Refresh means add or remove any changes between the new and old data
    // Concatenate means add both datasets together into the chart
    // FIXME: make this a UI option somehow.
    // For now we treat it like a refresh
    // if (myChart !== null) prepareDataRefresh(true);

    // chartTitle = fileInput.files[0].name;
    // createChart(data.data);
  // };

  // Start reading the file. When it is done, calls the onload event defined above.
  // reader.readAsText(fileInput.files[0]);
}