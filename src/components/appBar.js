import * as React from 'react';
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

import { GoogleLogin, googleLogout } from '@react-oauth/google';
import jwt_decode from "jwt-decode";


const pages = [
  { name: 'Strength Visualizer', route: 'visualizer'}, 
  { name: 'PR Analyzer', route: 'analyzer'}, 
  { name: 'E1RM Calculator', route: 'calculator'}, 
];

const settings = ['Profile', 'Settings'];

function ResponsiveAppBar() {
  const [anchorElNav, setAnchorElNav] = React.useState(null);
  const [anchorElUser, setAnchorElUser] = React.useState(null);

  // FIXME: these auth related items could be grouped together in one state object
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [userName, setUserName] = React.useState(null);
  const [avatarUrl, setAvatarUrl] = React.useState(null);

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

  const onGoogleLoginSuccess = (credentialResponse) => {
    let decodedResponse = jwt_decode(credentialResponse.credential);
    setUserName(`${decodedResponse.name} (${decodedResponse.email})`); 
    setAvatarUrl(decodedResponse.picture);
    // console.log(decodedResponse);
    setIsAuthenticated(true);
  };

  const onGoogleLoginFailure = (err) => {
    console.log('failed:', err);
  };

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
              <Box sx={{ flexGrow: 0 }}>
                <Tooltip title={userName}>
                  <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                    <Avatar alt={userName} src={avatarUrl} />
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
              <GoogleLogin
                onSuccess={onGoogleLoginSuccess}
                onError={onGoogleLoginFailure}
                size="large"
                type="standard"
                shape="circle"
              />
            </>
          }
                
        </Toolbar>
      </Container>
    </AppBar>
  );
}


export default ResponsiveAppBar;