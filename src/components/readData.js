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

import axios from 'axios';
import { parseData } from './parseData';

export const loadGSheetData = async (tokenResponse, ssid) => {

  // FIXME: Firstly do a metadata check api request for modified time.

  // Attempt to load gsheet data
  let rawData = await axios
    .get(`https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/A%3AZ?dateTimeRenderOption=FORMATTED_STRING&key=${process.env.REACT_APP_GOOGLE_API_KEY}`, {
      headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
    })
    .then(res => res.data);

  // FIXME: check for errors and return false if we fail

  console.log(rawData);

  // Now we have good rawData we should parse it.
  parseData(rawData.values);

  return true;
}