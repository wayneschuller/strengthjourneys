/** @format */
// welcome.js - Welcome page components

import { React, useState } from "react";
import { GoogleAuthButton } from "./appBar";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CloseIcon from "@mui/icons-material/Close";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Unstable_Grid2";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Modal from "@mui/material/Modal";
import Slide from "@mui/material/Slide";
import Typography from "@mui/material/Typography";

import logo from "./sample_google_sheet_fuzzy_border.png";

export const sampleGSheet =
  "https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0";

export function DemoModeWelcome() {
  return (
    <>
      {/* <Box sx={{ m: 3, width: "90%" }} color="secondary" align="center"> */}
      {/* <Grid container rowSpacing={1} columnSpacing={{ xs: 1, sm: 2, md: 8 }}> */}
      <Grid container spacing={2} display="flex" justifyContent="center">
        <Grid sm={12} display="flex" justifyContent="center" alignItems="start">
          <h1>Strength Journeys</h1>
        </Grid>
        <Grid sm={12} lg={8}>
          <h3>Visualize your lifting history, lift consistently for a long time.</h3>
          <p>We recommend every lifter keep their own Google Sheet records.</p>
          <p>Click "Google Sign In" to give Strength Journeys read only access to visualize your data.</p>
        </Grid>
        <Grid sm={13} lg={4}>
          <a href={sampleGSheet} target="_blank">
            Sample Google Sheet format
          </a>
          <Link href={sampleGSheet}>
            <Box component="img" width="100%" alt="Sample Google Sheet Data" src={logo} />
          </Link>
        </Grid>
      </Grid>
      {/* </Box> */}
    </>
  );
}

export function NewUserWelcome(props) {
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
          <a href={sampleGSheet} target="_blank">
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
    <Box sx={{ m: 1 }} md={{ m: 8 }}>
      <Slide direction="right" in={true}>
        <Container maxWidth="xl" sx={{ borderRadius: "6px", border: "0px solid grey", backgroundColor: "#bbaaee" }}>
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
            <Box mt={3} align="center">
              <GoogleAuthButton />
            </Box>
          </Box>
        </Container>
      </Slide>
    </Box>
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
    </div>
  );
}

const style = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "70%",
  bgcolor: "background.paper",
  border: "1px solid #000",
  boxShadow: 24,
  p: 4,
};

// When in demo mode, we will pop this up every now and then
// FIXME: The google sign in button does not close the modal but it should.
export function WelcomeModal() {
  const [open, setOpen] = useState(true);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  return (
    <div>
      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={style}>
          <Grid display="flex" justifyContent="end">
            <Grid sm={12} lg={8}>
              <IconButton onClick={handleClose}>
                <CloseIcon />
              </IconButton>
            </Grid>
          </Grid>
          <DemoModeWelcome />
        </Box>
      </Modal>
    </div>
  );
}
