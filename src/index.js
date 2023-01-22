/** @format */

import React from "react";
import ReactDOM from "react-dom/client";
import { Routes, Route, BrowserRouter, Navigate } from "react-router-dom";

import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";

import { createTheme, ThemeProvider } from "@mui/material/styles";
import color from "@mui/material/colors/indigo";

import { GoogleOAuthProvider } from "@react-oauth/google";

import Analyzer from "./pages/analyzer";
import Home from "./pages/home";
import NoMatch from "./pages/nomatch";
import OneRepMaxCalculator from "./pages/oneRepMaxCalculator";
import Visualizer from "./pages/visualizer";

import "typeface-roboto";
import "typeface-catamaran";

const theme = createTheme({
  typography: {
    // fontSize: 12,
    // FIXME: Leave Roboto for titles, but choose Catamaran for body
  },
  palette: {
    // primary: color,
    primary: {
      main: "#393e46",
    },
    neutral: {
      main: "#64748B",
      contrastText: "#fff",
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));

// Spew a console.error and html error if we don't the process.env keys we need

root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
      <ThemeProvider theme={theme}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<App />}>
              <Route path="/" element={<Navigate replace to="/visualizer" />} />

              <Route path="visualizer" element={<Visualizer />} />
              <Route path="analyzer" element={<Analyzer />} />
              <Route path="calculator" element={<OneRepMaxCalculator />} />
              <Route path="*" element={<NoMatch />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
