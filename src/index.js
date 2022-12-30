import React from 'react';
import ReactDOM from 'react-dom/client';
import { Routes, Route, BrowserRouter, Navigate } from "react-router-dom";

import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { CookiesProvider } from 'react-cookie';

import { createTheme, ThemeProvider } from '@mui/material/styles';
import color from '@mui/material/colors/indigo';

import { GoogleOAuthProvider } from '@react-oauth/google';

import Analyzer from './pages/analyzer';
import Home from './pages/home';
import NoMatch from './pages/nomatch';
import OneRepMaxCalculator from './pages/oneRepMaxCalculator';
import Visualizer from './pages/visualizer';

const theme = createTheme({
  palette: {
    primary: color,
  },
});

const root = ReactDOM.createRoot(document.getElementById('root'));

// FIXME: the index <Home /> element resets the whole app
// TODO: Maybe just delete the index <Home /> stuff and default to visualizer page?

root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
      <CookiesProvider>
        <ThemeProvider theme={theme}>
          <BrowserRouter>
            <Routes>

              {/* FIXME: How can code so wrong work so right? */}
              <Route path="/" element={<App />}>
              <Route path="/" element={ <Navigate replace to="/visualizer" /> } /> 

              <Route path="visualizer" element={<Visualizer />} />
              <Route path="analyzer" element={<Analyzer />} />
              <Route path="calculator" element={<OneRepMaxCalculator />} />
              <Route path="*" element={<NoMatch />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
     </CookiesProvider>
  </GoogleOAuthProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
