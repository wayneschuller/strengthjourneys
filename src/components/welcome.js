/** @format */
// welcome.js - Welcome page components

import { React } from "react";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";

export function NewUserWelcome() {
  return (
    <Box sx={{ m: 1 }} md={{ m: 3 }}>
      <Container
        maxWidth="xl"
        sx={{ borderRadius: "6px", border: "1px solid grey", backgroundColor: "palette.secondary.light" }}
      >
        <h1>Welcome to Strength Journeys</h1>
        <h3>Visualize your lifting history - lift consistently for a long time.</h3>
        <p>
          We recommend every lifter record and own their own data in a Google Sheet. (Don't just let your health and
          fitness data be trapped in someone else's application.)
        </p>
        <p>
          Here is our custom{" "}
          <a
            href="https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0"
            target="_blank"
          >
            Google Sheet data format
          </a>
          . From Google Sheets, click "File" menu and then click "Make a copy" and edit with your data.
        </p>
      </Container>
    </Box>
  );
}

// FIXME: this really should not depend on tokenResponse, but on isDataReady or put logic above it
export function ReturningUserWelcome({ tokenResponse }) {
  return (
    <div>
      <Container
        maxWidth="xl"
        sx={{ borderRadius: "6px", border: "1px solid grey", backgroundColor: "palette.secondary.light" }}
      >
        <h1>Welcome back to Strength Journeys.</h1>
        <h3>You are looking stronger than last time.</h3>

        {!tokenResponse && (
          <>
            <h3>
              Please click the "Google sign-in" button in the top right corner and we will visualize your greatness.
            </h3>
          </>
        )}
      </Container>
    </div>
  );
}
