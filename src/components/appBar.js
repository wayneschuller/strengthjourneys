import { useState } from 'react';
import { Link } from "react-router-dom";

import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuIcon from '@mui/icons-material/Menu';
import Container from '@mui/material/Container';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import MenuItem from '@mui/material/MenuItem';

// MUI icons
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';

import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import useDrivePicker from 'react-google-drive-picker'

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

  const cookies = props.cookies;
  const setCookie = props.setCookie;
  const removeCookie = props.removeCookie;
  const userInfo = props.userInfo;
  const setUserInfo = props.setUserInfo; 
  const infoChipStatus = props.infoChipStatus;
  const setInfoChipStatus = props.setInfoChipStatus;
  const infoChipToolTip = props.infoChipStatus;
  const setInfoChipToolTip = props.setInfoChipToolTip;
  const getGoogleUserInfo = props.getGoogleUserInfo;
  const loadGSheetValues = props.loadGSheetValues;
  const setVisualizerData = props.setVisualizerData;
  const isLoading = props.isLoading;
  const setIsLoading = props.setIsLoading;

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
    setVisualizerData(null);  // Reset the graph
    setAnchorElUser(null);  // Closes menu
  };

  // console.log(`Top level <ResponsiveAppBar />...`);

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
  const openGDrivePicker = () => {
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
          // console.log('User clicked cancel GDrive Picker')
          return;
        }

        setInfoChipToolTip(data.docs[0].name);

        console.log(`User chose ssid. New: ${data.docs[0].id}. Old cookie: ${cookies.ssid}`)
        // Have they chosen a different file to previously?
        if (data.docs[0].id !== cookies.ssid) {
          // park the ssid in the browser cookie - expires in a year. They can change it anytime.
          let d = new Date(); d.setTime(d.getTime() + (365*24*60*60*1000)); // 365 days from now
          setCookie('ssid', data.docs[0].id, { path: '/', expires: d });
          // setDataModifiedTime(0); // FIXME: do we need this?
          console.log(data)
        }

        loadGSheetValues(data.docs[0].id, cookies.tokenResponse); 
      },
    });
  }

  // TODO: We really need to handle 3 use cases 
  // 1. Absolute first time user. Nice hero page with explanation and images etc.
  // 2. Returning user with an expired token. Welcome them back, explain the process
  // 3. Returning user with valid token - insta load the data 
  return (
    <AppBar position="static">
      <Container maxWidth="xl">
        <Toolbar disableGutters>

          <FitnessCenterIcon sx={{ display: { xs: 'none', md: 'flex' }, mr: 1 }} />
          <Typography
            variant="h6"
            noWrap
            component="a"
            // href="/"
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

          { isLoading && <CircularProgress color="success" /> }

          {/* User profile info on right hand side of the navbar */}
          { userInfo ?  
            <>

              <Tooltip title={infoChipToolTip}>
                <Chip 
                  label={infoChipStatus}
                  onClick={() => openGDrivePicker()}
                  variant="filled"
                  color="info"
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