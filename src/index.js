import React from 'react';
import ReactDOM from 'react-dom/client';
import { Routes, Route, BrowserRouter } from "react-router-dom";

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

root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
      <CookiesProvider>
        <ThemeProvider theme={theme}>

        <BrowserRouter>
      {/* Routes nest inside one another. Nested route paths build upon
            parent route paths, and nested route elements render inside
            parent route elements. See the note about <Outlet> below. */}
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Home />} />
          <Route path="visualizer" element={<Visualizer />} />
          <Route path="analyzer" element={<Analyzer />} />
          <Route path="calculator" element={<OneRepMaxCalculator />} />

          {/* Using path="*"" means "match anything", so this route
                acts like a catch-all for URLs that we don't have explicit
                routes for. */}
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
