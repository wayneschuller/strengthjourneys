/** @format */

import { useState } from "react";
import { Link } from "react-router-dom";

import AppBar from "@mui/material/AppBar";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuIcon from "@mui/icons-material/Menu";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import MenuItem from "@mui/material/MenuItem";

import logo from "./logo.png";
import GitHubIcon from "@mui/icons-material/GitHub";
import GoogleIcon from "@mui/icons-material/Google";

import { loadGSheetValues } from "../utils/readData";
import { useAuth } from "../utils/auth";

import useDrivePicker from "react-google-drive-picker";

// Array of main menu items
const pages = [
  { name: "Strength Visualizer", route: "visualizer" },
  { name: "PR Analyzer", route: "analyzer" },
  { name: "E1RM Calculator", route: "calculator" },
];

const settings = ["Report Issue", "Email Author", "Logout"]; // If we ever need a settings menu - put it here

function ResponsiveAppBar(props) {
  const [anchorElNav, setAnchorElNav] = useState(null);
  const [anchorElUser, setAnchorElUser] = useState(null);
  const auth = useAuth();

  // FIXME: This is not best practice
  const userInfo = props.userInfo;
  const setUserInfo = props.setUserInfo;
  const infoChipStatus = props.infoChipStatus;
  const setInfoChipStatus = props.setInfoChipStatus;
  const infoChipToolTip = props.infoChipToolTip;
  const setInfoChipToolTip = props.setInfoChipToolTip;
  const setIsLoading = props.setIsLoading;
  const setIsDataReady = props.setIsDataReady;
  const setParsedData = props.setParsedData;
  const setAnalyzerData = props.setAnalyzerData;
  const visualizerData = props.visualizerData;
  const setVisualizerData = props.setVisualizerData;

  // console.log(`<ResponsiveAppBar />...`);

  const handleOpenNavMenu = (event) => {
    setAnchorElNav(event.currentTarget);
  };
  const handleOpenUserMenu = (event) => {
    setAnchorElUser(event.currentTarget);
  };

  // Called when one of the menu items is clicked
  const handleCloseNavMenu = () => {
    // console.log(`menu item clicked ${Boolean(anchorElNav)}`);
    setAnchorElNav(null);
  };

  // Called when one of the right hand side settings menus is clicked
  const handleCloseUserMenu = (setting) => {
    setAnchorElUser(null);
    if (setting === "Report Issue") {
      console.log("Report Issue clicked");
      window.open("https://github.com/wayneschuller/strengthjourneys/issues");
    } else if (setting === "Email Author") {
      window.open("mailto:wayneschuller@gmail.com?subject=Thank you for Strength Journeys it is the best!");
    } else if (setting === "Logout") {
      console.log("Logout clicked");
      setIsDataReady(false);
      // googleLogout();
      auth.signout();
      // localStorage.removeItem("tokenResponse");
      localStorage.removeItem("googleCredential");
      localStorage.removeItem("selectedLifts");
      localStorage.removeItem("ssid");
      localStorage.removeItem("gSheetName");
      setIsLoading(false);
      setVisualizerData(null); // FIXME: nullify the internals more carefully to remove chart etc
      setUserInfo(null); // This will remove the profile menu and status button
      setAnchorElUser(null); // Closes menu
    }
  };

  // console.log(`Top level <ResponsiveAppBar />...`);

  const [openPicker, authResponse] = useDrivePicker();
  const openGDrivePicker = () => {
    // const tokenResponse = JSON.parse(localStorage.getItem("tokenResponse"));
    // console.log(tokenResponse);
    const credential = JSON.parse(localStorage.getItem(`googleCredential`));
    console.log(`Opening picker with token ${credential.accessToken}`);

    openPicker({
      clientId: process.env.REACT_APP_GOOGLE_CLIENT_ID,
      developerKey: process.env.REACT_APP_GOOGLE_API_KEY,
      appId: process.env.REACT_APP_GOOGLE_APP_ID,
      viewId: "SPREADSHEETS",
      // token: auth.user.accessToken, // Pass a pre-obtained token with drive.file scope
      token: credential.accessToken, // Pass a pre-obtained token with drive.file scope
      showUploadView: true,
      showUploadFolders: true,
      supportDrives: true,
      multiselect: false,
      callbackFunction: (data) => {
        if (data.action === "cancel") {
          // console.log('User clicked cancel GDrive Picker')
          return;
        }
        setInfoChipToolTip(data.docs[0].name);
        localStorage.setItem("gSheetName", data.docs[0].name);

        localStorage.setItem("ssid", data.docs[0].id);

        // FIXME: we cannot change Google Sheets without reloading the app. BUG
        // It the app is already loaded with data, we need to clear the data before we load the new file
        localStorage.removeItem(`selectedLifts`); // Clear the selected lifts before we process the new file
        setVisualizerData(null); // FIXME: nullify the internals more carefully to remove chart etc
        setAnalyzerData(null);
        setParsedData(null);

        setIsDataReady(false);
        setIsLoading(true);

        setInfoChipStatus("Loading GSheet Values");
        loadGSheetValues(
          setInfoChipStatus,
          setInfoChipToolTip,
          setIsLoading,
          setIsDataReady,
          visualizerData,
          setVisualizerData,
          setParsedData,
          setAnalyzerData
        );
      },
    });
  };

  return (
    <AppBar position="static">
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          {/* Show the SJ logo on the left on md+ sizes  */}
          <Box
            component="img"
            width="10%"
            sx={{
              display: { xs: "none", md: "block" },
            }}
            alt="Strength Journeys logo"
            src={logo}
          />
          <Box sx={{ flexGrow: 1, display: { xs: "flex", md: "none" } }}>
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleOpenNavMenu}
              color="inherit"
            >
              <MenuIcon />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorElNav}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "left",
              }}
              keepMounted
              transformOrigin={{
                vertical: "top",
                horizontal: "left",
              }}
              open={Boolean(anchorElNav)}
              onClose={handleCloseNavMenu}
              sx={{
                display: { xs: "block", md: "none" },
              }}
            >
              {pages.map((page) => (
                <MenuItem key={page.name} onClick={handleCloseNavMenu}>
                  <Link style={{ textDecoration: "none" }} to={`/${page.route}`}>
                    <Typography textAlign="center">{page.name}</Typography>
                  </Link>
                </MenuItem>
              ))}
            </Menu>
          </Box>
          {/* Show the logo in the middle on xs sizes  */}
          <Box
            component="img"
            width="20%"
            sx={{
              display: { xs: "flex", md: "none" },
            }}
            alt="Strength Journeys logo"
            src={logo}
          />
          <Box sx={{ flexGrow: 1, display: { xs: "none", md: "flex" } }}>
            {pages.map((page) => (
              <Button
                key={page.name}
                onClick={handleCloseNavMenu}
                sx={{ my: 2, color: "white", display: "block", mx: 1 }}
                variant="contained"
                component={Link}
                to={`/${page.route}`}
              >
                {page.name}
              </Button>
            ))}
          </Box>
          {/* Link to our GitHub project on large screens */}
          <Avatar
            sx={{ bgcolor: "#333333", display: { xs: "none", md: "flex" } }}
            variant="rounded"
            onClick={(event) => window.open("https://github.com/wayneschuller/strengthjourneys", "_blank")}
          >
            <Tooltip title="Click to open GitHub source code">
              <GitHubIcon
              // sx={{
              // display: { xs: "none", md: "block" },
              // }}
              />
            </Tooltip>
          </Avatar>

          {/* User profile info on right hand side of the navbar */}
          {auth.user ? (
            <>
              <Tooltip title={infoChipToolTip}>
                <Chip
                  label={infoChipStatus}
                  onClick={() => openGDrivePicker()}
                  variant="filled"
                  color="neutral"
                  sx={{ color: "white", mx: 1 }}
                />
              </Tooltip>

              <Box sx={{ flexGrow: 0 }}>
                <Tooltip title={auth.user.name}>
                  <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                    <Avatar alt={auth.user.name} src={auth.user.photoUrl} />
                  </IconButton>
                </Tooltip>
                <Menu
                  sx={{ mt: "45px" }}
                  id="menu-appbar"
                  anchorEl={anchorElUser}
                  anchorOrigin={{
                    vertical: "top",
                    horizontal: "right",
                  }}
                  keepMounted
                  transformOrigin={{
                    vertical: "top",
                    horizontal: "right",
                  }}
                  open={Boolean(anchorElUser)}
                  onClose={handleCloseUserMenu}
                >
                  {settings.map((setting) => (
                    <MenuItem
                      key={setting}
                      onClick={() => {
                        handleCloseUserMenu(setting);
                      }}
                    >
                      <Typography textAlign="center">{setting}</Typography>
                    </MenuItem>
                  ))}
                </Menu>
              </Box>
            </>
          ) : (
            <>
              <Tooltip title="Sign in and connect to your Google Sheet">
                <Button
                  onClick={(e) => auth.signinWithGoogle()}
                  sx={{ color: "white", display: "block" }}
                  variant="outlined"
                >
                  Google Sign-In
                </Button>
              </Tooltip>
            </>
          )}
        </Toolbar>
      </Container>
    </AppBar>
  );
}

export default ResponsiveAppBar;
