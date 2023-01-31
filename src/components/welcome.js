/** @format */
// welcome.js - Welcome page components

import { React } from "react";
import { GoogleAuthButton } from "./appBar";

import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import { Typography } from "@mui/material";

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

export function NewUserHero() {
  return (
    <Container maxWidth="xl">
      {/* <Box textAlign="center" color="common.white"> */}
      <Box textAlign="center">
        <Typography variant="h2" component="h2" gutterBottom={true}>
          <Typography color="secondary" variant="h2" component="span">
            Visualize your lifting history,{" "}
          </Typography>
          <Typography color="secondary" variant="h2" component="span">
            lift consistently for a long time.
          </Typography>
        </Typography>
        <Container maxWidth="sm">
          <Typography variant="subtitle1" color="textSecondary" paragraph={true}>
            Welcome to Strength Journeys.
          </Typography>
        </Container>
        <Box mt={3}>
          <GoogleAuthButton />
        </Box>
      </Box>
    </Container>
  );
}

export function ReturningUserWelcome({}) {
  return (
    <div>
      <Container
        maxWidth="xl"
        sx={{ borderRadius: "6px", border: "1px solid grey", backgroundColor: "palette.secondary.light" }}
      >
        <h1>Welcome back to Strength Journeys.</h1>
        <h3>You are looking stronger than last time.</h3>
      </Container>
      {/* <NewUserHero /> */}
    </div>
  );
}
