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
import { defaultVisualizerData } from './visualizerDataProcessing';

// Array of main menu items
const pages = [
  { name: 'Strength Visualizer', route: 'visualizer'}, 
  { name: 'PR Analyzer', route: 'analyzer'}, 
  { name: 'E1RM Calculator', route: 'calculator'}, 
];

const settings = ['Profile', 'Settings'];

function ResponsiveAppBar(props) {
  const [anchorElNav, setAnchorElNav] = useState(null);
  const [anchorElUser, setAnchorElUser] = useState(null);

  const [cookies, setCookie, removeCookie] = useCookies(['ssid', 'tokenResponse']);

  // We inherit some state from our parent <App /> 
  let setParsedData = props.setParsedData;
  let setVisualizerData = props.setVisualizerData;

  const [userInfo, setUserInfo] = useState(null);  // .name .picture .email (from Google userinfo API)

  // These next four could be grouped into one dataSource object?
  const [dataSourceStatus, setDataSourceStatus] = useState("Choose Data Source");  // Used in the navbar info chip-button
  const [infoChipToolTip, setInfoChipToolTip] = useState(null);

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
    console.log("Logging out of google...");
    googleLogout();
    removeCookie('tokenResponse'); // Forget the tokenReponse 
    setUserInfo(null);    // This will remove the profile menu and status button
    setVisualizerData(defaultVisualizerData);  // Reset the graph
    setAnchorElUser(null);  // Closes menu
  };

  // -------------------------------------------------------------------------------------------------
  // If we have a new tokenResponse, ssid (FIXME: or modified time) then 
  // work through the chain of API requests: 
  //
  //    getGoogleUserInfo->checkGSheetModified->loadGSheetValues
  //
  // Along the way we update various important pieces of UI state.
  // -------------------------------------------------------------------------------------------------
  useEffect(() => {
    console.log(`useEffect tokenResponse/cookie changed:`);
    // console.log(cookies.tokenResponse);

    if (!cookies.tokenResponse) return; // No ticket to google? Then no party.

    console.log(`useEffect: We now have a tokenResponse, let's talk to Google...`);

    async function getGoogleUserInfo () {
      // API request to get Google user info from our tokenResponse (used for profile avatar on navbar top right)
      await axios
        .get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${cookies.tokenResponse.access_token}` },
        })
        .then((response) => {
          // handle success
          console.log(`axios.get UserInfo success: response.data: ${JSON.stringify(response.data)}`);
          setUserInfo(response.data);

          // If we have an ssid then we can go to the next step in the chain
          if (cookies.ssid !== undefined) 
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
          console.log(`axios.get GDrive file metadata .then received:`);
          console.log(response.data);
          setInfoChipToolTip(response.data.name);

          // FIXME: if we don't have sheet values or if modified time has change then next step in the chain

          loadGSheetValues();
        })
        .catch((error) => {
          setDataSourceStatus("Error Reading GDrive File Metadata");
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
          console.log(`axios.get GSheet metadata .then received:`);
          console.log(response.data);
        })
        .catch((error) => {
          setDataSourceStatus("Error Reading Google Sheet Metadata");
          setInfoChipToolTip(error.response.data.error.message);
          console.log(error);
        })
    }

    async function loadGSheetValues () {
      console.log("loadGSheetValues()...");

      await axios
      .get(`https://sheets.googleapis.com/v4/spreadsheets/${cookies.ssid}/values/A%3AZ?dateTimeRenderOption=FORMATTED_STRING&key=${process.env.REACT_APP_GOOGLE_API_KEY}`, {
          headers: { Authorization: `Bearer ${cookies.tokenResponse.access_token}` },
        })
        .then((response) => {
          // handle success
          console.log(`axios.get success: range is ${response.data.range}`);
          let parsedData = parseData(response.data.values);
          console.log(`setParsedData to: ${JSON.stringify(parsedData[0])}`);
          setParsedData(parsedData);
          setDataSourceStatus("Data Source Connected");
        })
        .catch((error) => {
          setDataSourceStatus("Error Reading Google Sheet");
          setInfoChipToolTip(error.response.data.error.message);
          console.log(error);
        })
    }

    getGoogleUserInfo();
  }, [cookies.tokenResponse, cookies.ssid, setParsedData])


  // Google API scopes required to read one google sheet
  const SCOPES = 'https://www.googleapis.com/auth/drive.file ' +
                 'https://www.googleapis.com/auth/spreadsheets.readonly ' +
                 'https://www.googleapis.com/auth/drive.metadata.readonly';

  // niceGoogleLogin uses implicit authorisation flow to get a tokenResponse (normally lasts 60 minutes)
  const niceGoogleLogin = useGoogleLogin({
    scope: SCOPES,
    onSuccess: async tokenResponse => {
      // console.log(tokenResponse);

      setDataSourceStatus("Select Data Source");

      // park the tokenResponse in the browser cookie - it is normally valid for about 1 hour
      setCookie('tokenResponse', JSON.stringify(tokenResponse), { path: '/', maxAge: tokenResponse.expires_in });
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
        }

        setInfoChipToolTip(data.docs[0].name);

        // park the ssid in the browser cookie - expires in a year. They can change it anytime.
        let d = new Date(); d.setTime(d.getTime() + (365*24*60*60*1000)); // 365 days from now
        setCookie('ssid', data.docs[0].id, { path: '/', expires: d });

        console.log(data)
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
              label={dataSourceStatus}
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