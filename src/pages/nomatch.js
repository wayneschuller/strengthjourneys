/** @format */

import { React } from "react";
import { Routes, Route, Outlet, Link } from "react-router-dom";

import Container from "@mui/material/Container";
import Box from "@mui/material/Box";

const NoMatch = () => {
  return (
    <div>
      <h2>Nothing to see here!</h2>
      <p>
        {" "}
        <Link to="/">Go to the home page</Link>{" "}
      </p>
    </div>
  );
};

export default NoMatch;
