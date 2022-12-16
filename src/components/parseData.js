// parseData.js
// Wayne Schuller, wayne@schuller.id.au
// Licenced under https://www.gnu.org/licenses/gpl-3.0.html
//
// parseData will take raw imported 2d grid data from different formats
// and parse into our common parsedData[] format.

// Globals 
const parsedData = []; // Every unique lift from our source

let workout_date_COL, workout_id_COL, completed_COL, exercise_name_COL, assigned_reps_COL, assigned_weight_COL;
let assigned_sets_COL, actual_reps_COL, actual_weight_COL, actual_sets_COL, missed_COL, description_COL, units_COL, notes_COL, url_COL;

let lastDate = "1999-12-31";
let lastLiftType = "Tik Tok Dancing"; 

// ------------------------------------------------------------------------------
// parseData
// Discern the raw data format, parse into the parsedData global
// Assumes raw lifting data[][] 2d grid (from CSV or Google Sheets or similar)
// ------------------------------------------------------------------------------
function parseData(data) {

  const columnNames = data[0];

  // Look for distinctive BTWB data columns - no one else will have a Pukie column
  if (columnNames[0] === "Date" && columnNames[4] === "Pukie") {
    // Dynamically find where all our needed columns are 
    workout_date_COL = columnNames.indexOf("Date");
    description_COL = columnNames.indexOf("Description");
    notes_COL = columnNames.indexOf("Notes");

    data.forEach(parseBtwbRow, parsedData);
    return;
  } 

  // Look for distinctive TurnKey (BLOC) data columns
  if (columnNames[0] === "user_name" && columnNames[1] === "workout_id") {

    // Dynamically find where all our needed columns are 
    workout_date_COL = columnNames.indexOf("workout_date");
    workout_id_COL = columnNames.indexOf("workout_id");
    completed_COL = columnNames.indexOf("workout_completed");
    exercise_name_COL = columnNames.indexOf("exercise_name");
    assigned_reps_COL = columnNames.indexOf("assigned_reps");
    assigned_weight_COL = columnNames.indexOf("assigned_weight");
    assigned_sets_COL = columnNames.indexOf("assigned_sets");
    actual_reps_COL = columnNames.indexOf("actual_reps");
    actual_weight_COL = columnNames.indexOf("actual_weight");
    actual_sets_COL = columnNames.indexOf("actual_sets");
    missed_COL = columnNames.indexOf("assigned_exercise_missed");
    units_COL = columnNames.indexOf("weight_units");

    data.forEach(parseBlocRow, parsedData);
    return;
  } 
   
  // From here let's just assume it is our bespoke CSV/GSheet format
  // FIXME: URL link to public Google Sheet sample
  workout_date_COL = columnNames.indexOf("Date");
  exercise_name_COL = columnNames.indexOf("Lift Type");
  actual_reps_COL = columnNames.indexOf("Reps");
  actual_weight_COL = columnNames.indexOf("Weight");
  notes_COL = columnNames.indexOf("Notes");
  url_COL = columnNames.indexOf("URL");

  data.forEach(parseBespokeRow, parsedData);
  return;
}

// ---------------------------------------------------------------------------------
// Array method to parse a row of Bespoke data as a liftEntry object into parsedData
// Goal is to make this as flexible as possible - it will be our most common data format
// ---------------------------------------------------------------------------------
function parseBespokeRow(row, index) {

  if (!row[actual_reps_COL] || row[actual_reps_COL] === "Reps") return false; // Bad row

  let date = row[workout_date_COL];

  // If date is empty we need to use the previous date in the dataset (via lastDate global)
  if (date === null || date === '') date = lastDate;
    else lastDate = date; // Remember good date in case we need it in a later row

  let liftType = row[exercise_name_COL];

  // If lift type is empty we need to use the previous lift type (via liftType global)
  if (liftType === null || liftType === '') liftType = lastLiftType;
    else lastLiftType = liftType; // Remember good life type in case we need it in a later row

  if (!row[actual_reps_COL] || !row[actual_weight_COL]) return false; // Do they even lift?

  if (liftType === "Sumo Deadlift") {
    console.log(`Warning: sumo deadlifter detected. For more information: https://youtu.be/dQw4w9WgXcQ`);
    // return;
  }

  const reps = row[actual_reps_COL];

  // Default will be to assume a raw number that is in pounds
  let weight = row[actual_weight_COL];

  // Look for units inside the weight string 
  if (row[actual_weight_COL].indexOf("kg") != -1) {
    unitType = "kg";
    weight = parseFloat(weight.slice(0, weight.length-2)); // Remove the units from the end
  } else if (row[actual_weight_COL].indexOf("lb") != -1) {
    unitType = "lb";
    weight = parseFloat(weight.slice(0, weight.length-2)); // Remove the units from the end
  } 

  if (reps === 0 || weight === 0) return false; // Do they even lift?

  // If we don't have these fields put in empty strings
  let url = row[url_COL]; if (!url) url = '';
  let notes = row[notes_COL]; if (!notes) notes = '';

  parsedData.push({
    date: date,
    name: liftType,
    reps: reps,
    weight: weight,
    units: unitType, 
    notes: notes,
    url: url,
  });
}

// --------------------------------------------------------------------------------
// Array method to pass a row of BTWB data as a liftEntry object into parsedData
// --------------------------------------------------------------------------------
function parseBtwbRow(row) {

  // console.log(`parseBtwbRow: ${JSON.stringify(row)}`);

  if (!row || row[0] === null) return; 

  // Find the exercise name AKA type of lift in this row
  const regex = /[a-zA-Z ]*/gm;
  const result = regex.exec(row[1]); // Second column has the description - FIXME: use const column index format
  const liftType = result[0].trim();

  if (liftType === "") return;

  // Our app is not very interested in Crossfit WODs yet
  // The CSV has no clear indication we can use, so just exclude a few obvious non-lifts
  if (liftType === "Every" || liftType === "FT" || liftType === "AMRAP" || liftType === "Chipper") return;

  // Loop through the lifts of this session and push them all to parsedData
  const lifts = row[description_COL].split(/\r?\n/); // BTWB has newlines inside the one cell entry
  for (let lift of lifts) {
    // Get number of reps
    let regex = /^[0-9]+/gm;  
    let result = regex.exec(lift);
    if (!result) continue;
    let curReps = parseFloat(result[0]);
    if (curReps == 0) continue; // FIXME: check why this would happen

    // Get units then weight
    if (lift.indexOf("kg") != -1) {
      unitType = "kg";
      regex = /[0-9|\.]+\skg$/gm; 
    } else if (lift.indexOf("lb") != -1) {
      unitType = "lb";
      regex = /[0-9|\.]+\slb$/gm; 
    } else continue; // We can't find units so it's probably not a lift 

    result = regex.exec(lift);
    if (!result) continue;
    const curWeight = parseFloat(result[0].slice(0, result[0].length-2)); // Remove the units (kg or lb) from the end
    if (curWeight == 0) continue;

    let notes = row[notes_COL]; if (!notes) notes = '';

    let liftEntry = {
      date: row[workout_date_COL],
      name: liftType,
      reps: curReps,
      weight: curWeight,
      units: unitType, 
      notes: notes,
      url: '',
    }

    parsedData.push(liftEntry); // add to our collection of parsed data
  }
}


// ---------------------------------------------------------------------------------
// Array method to parse a row of BLOC data as a liftEntry object into parsedData
// ---------------------------------------------------------------------------------
function parseBlocRow(row) {

  if (!row || row[0] === null) {
      // console.log(`parseBlocRow skipping bad row: ${JSON.stringify(row)}`);
      return; 
  }

  if (row[actual_reps_COL] === "actual_reps") return false; // Probably header row

  // Give up on this row if it is not a completed workout
  if (row[completed_COL] === false || row[completed_COL] === 'FALSE') return false;

  // Give up on this row if missed_COL is true 
  if (row[missed_COL] === true || row[missed_COL] === 'TRUE') return false;

  // Give up on this row if there are no assigned reps 
  // Happens when a BLOC coach leaves comments in the web app
  if (row[assigned_reps_COL] === null || row[assigned_reps_COL] === '') return false;

  let lifted_reps = row[assigned_reps_COL];
  let lifted_weight = row[assigned_weight_COL];

  // Override if there is an actual_reps and actual_weight as well
  // This happens when the person lifts different to what was assigned by their coach
  if (row[actual_reps_COL] && row[actual_weight_COL]) {
      lifted_reps = row[actual_reps_COL];
      lifted_weight = row[actual_weight_COL];
  }
   
  if (lifted_reps === 0 || lifted_weight === 0) return;

  unitType = row[units_COL]; // Record the units type global for later. (we assume it won't change in the CSV)

  const liftUrl = `https://www.barbelllogic.app/workout/${row[workout_id_COL]}`;

  let liftType = row[exercise_name_COL];

  if (liftType === "Squat") liftType = "Back Squat"; // Our other two data types prefer the full squat type

  // Expand BLOC sets into separate liftEntry tuples
  // This makes no difference to the graph, but it benefits a user wanting to convert their BLOC data to our bespoke format
  // It may help with some achievements and tonnage count in a future feature
  let sets = 1;
  if (row[assigned_sets_COL] && row[assigned_sets_COL] > 1) sets = row[assigned_sets_COL];
  if (row[actual_sets_COL] && row[actual_sets_COL] > 1) sets = row[actual_sets_COL];

  for (let i = 1; i <= sets; i++) {
    let notes = `Set ${i} of ${sets}`; 
    if (sets === 1) notes = ''; // No notes for a single set
    parsedData.push({
      date: row[workout_date_COL],
      name: liftType,
      reps: lifted_reps,
      weight: lifted_weight,
      url: liftUrl,
      units: unitType, 
      notes: notes, 
    });
  }
}

// Export the current parsedData to the user in a simple CSV format.
function exportRawCSV () {
  let csvContent = "data:text/csv;charset=utf-8,";

  csvContent += `"Date","Lift Type","Reps","Weight","Notes","URL"` + "\r\n"; // header row
  parsedData.forEach(function(lift) {
    let row = `${lift.date},"${lift.name}",${lift.reps},"${lift.weight}${lift.units}","${lift.notes}","${lift.url}"`;
    csvContent += row + "\r\n";
  });

  var encodedUri = encodeURI(csvContent);
  window.open(encodedUri);
}