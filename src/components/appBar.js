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
import axios from 'axios';
import useDrivePicker from 'react-google-drive-picker'
import { useCookies } from 'react-cookie';

// Array of main menu items
const pages = [
  { name: 'Strength Visualizer', route: 'visualizer'}, 
  { name: 'PR Analyzer', route: 'analyzer'}, 
  { name: 'E1RM Calculator', route: 'calculator'}, 
];

const settings = ['Profile', 'Settings'];

function ResponsiveAppBar() {
  const [anchorElNav, setAnchorElNav] = useState(null);
  const [anchorElUser, setAnchorElUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [tokenResponse, setTokenResponse] = useState(null);
  const [dataSourceStatus, setDataSourceStatus] = useState("Choose Data Source");
  const [ssid, setSsid] = useState(null);
  const [dataSourceName, setDataSourceName] = useState(null);
  const [cookies, setCookie] = useCookies(['ssid']);

  // When ssid changes (re)load the gsheet chart data 
  useEffect(() => {
    if (isAuthenticated) loadGSheetData();
  }, [ssid]) 

  const loadGSheetData = async () => {
    // Attempt to load gsheet data
    const sheetData = await axios
      .get(`https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/A%3AZ?dateTimeRenderOption=FORMATTED_STRING&key=${process.env.REACT_APP_GOOGLE_API_KEY}`, {
        headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
      })
      .then(res => res.data);

    console.log(sheetData);
    setDataSourceStatus("Data Source Connected");
  }

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
    setAnchorElUser(null);
    setIsAuthenticated(false);
  };

  // Google API scopes required to read one google sheet
  const SCOPES = 'https://www.googleapis.com/auth/drive.file';

  // niceGoogleLogin uses implicit authorisation flow to get a tokenResponse (normally lasts 60 minutes)
  const niceGoogleLogin = useGoogleLogin({
    scope: SCOPES,
    onSuccess: async tokenResponse => {
      console.log(tokenResponse);

      // REST request to get user info from our token (we show avatar on navbar top right)
      const userInfo = await axios
        .get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        })
        .then(res => res.data);

      setTokenResponse(tokenResponse);
      setUserInfo(userInfo); 
      setIsAuthenticated(true);
      setDataSourceStatus("Select Data Source");
      console.log(userInfo);

      // Now we are google authenticated, we are ready to check cookie for previous GSheet ssid
      if (cookies.ssid != undefined) setSsid(cookies.ssid);
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
      token: tokenResponse.access_token, // pass oauth token in case you already have one
      showUploadView: true,
      showUploadFolders: true,
      supportDrives: true,
      multiselect: true,
      // customViews: customViewsArray, // custom view
      callbackFunction: (data) => {
        if (data.action === 'cancel') {
          console.log('User clicked cancel/close button')
        }

        setDataSourceName(data.docs[0].name);

        // setSsid state which will trigger useEffect data (re)load
        setSsid(data.docs[0].id);

        // park the ssid in the browser cookie for next session
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
          { isAuthenticated ?  
            <>
              <Tooltip title={dataSourceName}>
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
              <Button onClick={() => niceGoogleLogin()} sx={{ my: 2, color: 'white', display: 'block', mx: 1 }} variant="outlined">Google Sign-In</Button>
            </>
          }
                
        </Toolbar>
      </Container>
    </AppBar>
  );
}


export default ResponsiveAppBar;