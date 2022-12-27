import { useState, useEffect} from 'react';
import { Link } from "react-router-dom";

import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
import MenuIcon from '@mui/icons-material/Menu';
import Container from '@mui/material/Container';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import Chip from '@mui/material/Chip';

import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import useDrivePicker from 'react-google-drive-picker'
import { useCookies } from 'react-cookie';
import axios from 'axios';

import { parseData } from './parseData';
import { defaultVisualizerData, processVisualizerData } from './visualizerDataProcessing';

// Array of main menu items
const pages = [
  { name: 'Strength Visualizer', route: 'visualizer'}, 
  { name: 'PR Analyzer', route: 'analyzer'}, 
  { name: 'E1RM Calculator', route: 'calculator'}, 
];

const settings = ['Profile', 'Settings'];

function ResponsiveAppBar({ setParsedData, setVisualizerData }) {
  const [anchorElNav, setAnchorElNav] = useState(null);
  const [anchorElUser, setAnchorElUser] = useState(null);

  const [cookies, setCookie, removeCookie] = useCookies(['ssid', 'tokenResponse']);

  const [userInfo, setUserInfo] = useState(null);  // .name .picture .email (from Google userinfo API)
  const [infoChipStatus, setInfoChipStatus] = useState("Choose Data Source");  // Used in the navbar info chip-button
  const [infoChipToolTip, setInfoChipToolTip] = useState(null);

  const [dataModifiedTime, setDataModifiedTime] = useState(0); // Unix timestamp

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
  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  // When user clicks logout menu in profile
  const handleUserMenuLogout = () => {
    // console.log("Logging out of google...");
    googleLogout();
    removeCookie('tokenResponse'); // Forget the tokenReponse 
    setUserInfo(null);    // This will remove the profile menu and status button
    setVisualizerData(defaultVisualizerData);  // Reset the graph
    setAnchorElUser(null);  // Closes menu
  };

  // console.log(`Top level <ResponsiveAppBar />...`);

  // If we have a stored token then likely we can login automatically
  // FIXME: I've moved this code back into the useEffect
  // if (!userInfo && cookies.tokenResponse && cookies.tokenResponse.access_token) {
    // console.log(`Attempting init data chain...${cookies.tokenResponse.access_token}`)
    // getGoogleUserInfo(cookies.tokenResponse);
  // }

  // ------------------------------------------------------------------
  // Data processing flow:
  //
  //    getGoogleUserInfo->checkGSheetModified->loadGSheetValues
  //
  // Flow is mostly triggered by event handlers
  // FIXME: figure out how to init run data processing flow if cookie token and ssid are there
  // ------------------------------------------------------------------
  // API request to get Google user info using the tokenResponse (used for profile avatar on navbar top right)
  async function getGoogleUserInfo(tokenResponse) {
    console.log(`getGoogleUserInfo()...`);

    if (!tokenResponse && tokenResponse.access_token) {
      console.log(`Can't get userInfo without tokenResponse...`);
      setVisualizerData(defaultVisualizerData);
      return; // No ticket to google? Then no party.
    }

    if (userInfo !== null) {
      console.log(`...ABORT as we seem to already have userInfo`);
    }

    await axios
      .get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
      })
      .then((response) => {
        // handle success
        console.log(`API get UserInfo success: response.data: ${JSON.stringify(response.data)}`);
        setUserInfo(response.data);

        // If we have a valid looking ssid then we can go to the next step in the chain
        if (cookies.ssid !== undefined && cookies.ssid.length > 10) 
          checkGSheetModified();
      })
      .catch((error) => {
        console.log(`axios.get UserInfo error:`);
        console.log(error.response);

        // Just in case we had a working tokenResponse that has now expired.
        setUserInfo(null);
        removeCookie('tokenResponse'); // Forget the tokenReponse 

      })
  }

    async function checkGSheetModified () {
      console.log("checkGSheetModified()...");

      // API call to get GDrive file metadata to get modified time and the filename
      await axios
        .get(`https://www.googleapis.com/drive/v3/files/${cookies.ssid}?fields=modifiedTime%2Cname&key=${process.env.REACT_APP_GOOGLE_API_KEY}`, {
          headers: { Authorization: `Bearer ${cookies.tokenResponse.access_token}` },
        })
        .then((response) => {
          // handle success
          console.log(`API get GDrive file metadata .then received:`);
          console.log(response.data);
          setInfoChipToolTip(response.data.name);

          // If the modified time is newer then refresh the data from Google Sheets
          const modifiedTime = Date.parse(response.data.modifiedTime);
          // console.log(`useState dataModifiedTime: ${dataModifiedTime}. Response: ${modifiedTime}`);
          if (modifiedTime > dataModifiedTime) {
            setDataModifiedTime(modifiedTime);
            loadGSheetValues(cookies.ssid);
          } else {
            console.log(`Google Sheet metadata check: modifiedtime is unchanged`);
          } 
        })
        .catch((error) => {
          setInfoChipStatus("Error Reading GDrive File Metadata");
          setInfoChipToolTip(error.response.data.error.message);
          console.log(error);
        })
    }

    // Gets interesting information about the sheet but not modified time
    // NOTE: Currently unused, but may be useful in the future
    async function getGSheetMetadata () {
      console.log("getGSheetMetadata()...");

      await axios
        .get(`https://sheets.googleapis.com/v4/spreadsheets/${cookies.ssid}?includeGridData=false`, {
          headers: { Authorization: `Bearer ${cookies.tokenResponse.access_token}` },
        })
        .then((response) => {
          // handle success
          // console.log(`API get GSheet metadata .then received:`);
          console.log(response.data);
        })
        .catch((error) => {
          setInfoChipStatus("Error Reading Google Sheet Metadata");
          setInfoChipToolTip(error.response.data.error.message);
          console.log(error);
        })
    }

    async function loadGSheetValues(ssid) {
      console.log("loadGSheetValues()...");

      await axios
      .get(`https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/A%3AZ?dateTimeRenderOption=FORMATTED_STRING&key=${process.env.REACT_APP_GOOGLE_API_KEY}`, {
          headers: { Authorization: `Bearer ${cookies.tokenResponse.access_token}` },
        })
        .then((response) => {
          // handle success
          console.log(`API get GSheet values success: range is ${response.data.range}`);
          let parsedData = parseData(response.data.values);
          // console.log(`setParsedData to: ${JSON.stringify(parsedData[0])}`);
          setParsedData(parsedData);    
          setInfoChipStatus("Data Source Connected");

          // Now is the right time to process the data for the visualizer
          let processed = processVisualizerData(parsedData);   // FIXME: check for errors?
          // console.log(`Here is processed[0]:`);
          // console.log(processed[0]);
          processed[0].hidden = false; // Unhide the most popular lift

          // FIXME: Don't manually set the lines like this - should be cleverer
          var wrapper = {
            // FIXME If we wrap the data array in an object this might become processed.datasets[0] etc
            datasets: [processed[0], processed[1], processed[2], processed[3]],
          }
          setVisualizerData(wrapper);
        })
        .catch((error) => {
          setInfoChipStatus("Error Reading Google Sheet");
          setInfoChipToolTip(error.response.data.error.message);
          console.log(error);
        })
    }

 
   // Event handlers do most of the data flow for us
   // However we want useEffect to autoload on init from cookies
   useEffect(() => {
    //  console.log(cookies.tokenResponse);

     if (!cookies.tokenResponse) {
      console.log(`   ...bailing out of useEffect - poor tokenResponse`)
      return; // No ticket to google? Then no party.
    }

    console.log(`useEffect: We now have a tokenResponse, let's talk to Google...`);
    getGoogleUserInfo(cookies.tokenResponse);

  }, [])


  // Google API scopes required to read one google sheet
  const SCOPES = 'https://www.googleapis.com/auth/drive.file ' +
                 'https://www.googleapis.com/auth/spreadsheets.readonly ' +
                 'https://www.googleapis.com/auth/drive.metadata.readonly';

  // niceGoogleLogin uses implicit authorisation flow to get a tokenResponse (normally lasts 60 minutes)
  const niceGoogleLogin = useGoogleLogin({
    scope: SCOPES,
    onSuccess: async tokenResponse => {
      // park the tokenResponse in the browser cookie - it is normally valid for about 1 hour
      setCookie('tokenResponse', JSON.stringify(tokenResponse), { path: '/', maxAge: tokenResponse.expires_in });

      console.log(tokenResponse);

      setInfoChipStatus("Select Data Source");

      getGoogleUserInfo(tokenResponse);
    },
    onError: errorResponse => console.log(errorResponse),
  });  


  const [openPicker, authResponse] = useDrivePicker();  
  // const customViewsArray = [new google.picker.DocsView()]; // custom view
  const handleOpenPicker = () => {
    openPicker({
      clientId: process.env.REACT_APP_GOOGLE_CLIENT_ID,
      developerKey: process.env.REACT_APP_GOOGLE_API_KEY,
      viewId: "SPREADSHEETS",
      token: cookies.tokenResponse.access_token, // pass oauth token in case you already have one
      showUploadView: true,
      showUploadFolders: true,
      supportDrives: true,
      multiselect: true,
      // customViews: customViewsArray, // custom view
      callbackFunction: (data) => {
        if (data.action === 'cancel') {
          console.log('User clicked cancel/close button')
          removeCookie('ssid'); // Forget the ssid previously chosen
          return;
        }

        setInfoChipToolTip(data.docs[0].name);

        console.log(`User chose ssid. New: ${data.docs[0].id}. Old cookie: ${cookies.ssid}`)
        // Have they chosen a different file to previously?
        if (data.docs[0].id !== cookies.ssid) {
          // park the ssid in the browser cookie - expires in a year. They can change it anytime.
          let d = new Date(); d.setTime(d.getTime() + (365*24*60*60*1000)); // 365 days from now
          setCookie('ssid', data.docs[0].id, { path: '/', expires: d });
          setDataModifiedTime(0); // Reset this for new file modified time to be loaded in
          console.log(data)
        }

        loadGSheetValues(data.docs[0].id); 
      },
    });
  }

  return (
    <AppBar position="static">
      <Container maxWidth="xl">
        <Toolbar disableGutters>


          <FitnessCenterIcon sx={{ display: { xs: 'none', md: 'flex' }, mr: 1 }} />
          <Typography
            variant="h6"
            noWrap
            component="a"
            href="/"
            sx={{
              mr: 2,
              display: { xs: 'none', md: 'flex' },
              fontFamily: 'monospace',
              fontWeight: 700,
              letterSpacing: '.3rem',
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
           SJ 
          </Typography>

          <Box sx={{ flexGrow: 1, display: { xs: 'flex', md: 'none' } }}>
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
                vertical: 'bottom',
                horizontal: 'left',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'left',
              }}
              open={Boolean(anchorElNav)}
              onClose={handleCloseNavMenu}
              sx={{
                display: { xs: 'block', md: 'none' },
              }}
            >
              {pages.map((page) => (
                <MenuItem key={page.name} onClick={handleCloseNavMenu}>
                  <Link 
                    style = {{ textDecoration: "none" }}
                    to={`/${page.route}`}
                  >
                    <Typography textAlign="center">
                      {page.name}
                    </Typography>
                  </Link>
                </MenuItem>
              ))}
            </Menu>
          </Box>

          <FitnessCenterIcon sx={{ display: { xs: 'flex', md: 'none' }, mr: 1 }} />
          <Typography
            variant="h5"
            noWrap
            component={Link} to="/"
            sx={{
              mr: 2,
              display: { xs: 'flex', md: 'none' },
              flexGrow: 1,
              fontFamily: 'monospace',
              fontWeight: 700,
              letterSpacing: '.3rem',
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            SJ
          </Typography>
          <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' } }}>
            {pages.map((page) => (
              <Button
                key={page.name}
                onClick={handleCloseNavMenu}
                sx={{ my: 2, color: 'white', display: 'block', mx: 1 }}
                variant="contained"
                component={Link} to={`/${page.route}`}
              >
                  {page.name}
              </Button>
            ))}
          </Box>


          {/* User profile info on right hand side of the navbar */}
          { userInfo ?  
            <>
              <Tooltip title={infoChipToolTip}>
              <Chip 
              label={infoChipStatus}
              onClick={() => handleOpenPicker()}
              variant="outlined"
              sx={{ color: 'white', mx: 1 }}
              />
              </Tooltip>

              <Box sx={{ flexGrow: 0 }}>
                <Tooltip title={userInfo.name}>
                  <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                    <Avatar alt={userInfo.name} src={userInfo.picture} />
                  </IconButton>
                </Tooltip>
                <Menu
                  sx={{ mt: '45px' }}
                  id="menu-appbar"
                  anchorEl={anchorElUser}
                  anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                  keepMounted
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                  open={Boolean(anchorElUser)}
                  onClose={handleCloseUserMenu}
                >
                  {settings.map((setting) => (
                    <MenuItem key={setting} onClick={handleCloseUserMenu}>
                      <Typography textAlign="center">{setting}</Typography>
                    </MenuItem>
                  ))}

                    <MenuItem onClick={handleUserMenuLogout}>
                      <Typography textAlign="center">Logout</Typography>
                    </MenuItem>

                </Menu>
              </Box>
            </> : <>
              <Tooltip title="Sign in and connect to your Google Sheet">
                <Button onClick={niceGoogleLogin} sx={{ my: 2, color: 'white', display: 'block', mx: 1 }} variant="outlined">Google Sign-In</Button>
              </Tooltip>
            </>
          }
                
        </Toolbar>
      </Container>
    </AppBar>
  );
}

export default ResponsiveAppBar;