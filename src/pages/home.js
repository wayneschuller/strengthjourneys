/** @format */

import { React } from "react";

import Container from "@mui/material/Container";
import Box from "@mui/material/Box";

const Home = () => {
  return (
    <div>
      <Box sx={{ m: 1 }} md={{ m: 3 }}>
        <Container
          maxWidth="xl"
          sx={{ borderRadius: "6px", border: "1px solid grey", backgroundColor: "palette.secondary.light" }}
        >
          <h1>Welcome to Strength Journeys</h1>
          <h3>Visualize your lifting history - lift consistently for a long time.</h3>
        </Container>
      </Box>
    </div>
  );
};

export default Home;
