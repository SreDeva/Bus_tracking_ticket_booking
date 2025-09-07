import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  InputAdornment,
  Divider,
  Chip
} from '@mui/material';
import {
  Email as EmailIcon,
  Lock as LockIcon,
  AdminPanelSettings as AdminIcon
} from '@mui/icons-material';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);

    if (!result.success) {
      setError(result.error);
    }

    setLoading(false);
  };

  return (
    <Container
      component="main"
      maxWidth="lg"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        py: 6,
        px: { xs: 2, sm: 4, md: 6 }
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 1200 }}>
        <Box
          sx={{
            display: 'flex',
            width: '100%',
            gap: { xs: 2, md: 6 },
            alignItems: 'stretch',
            flexDirection: { xs: 'column', md: 'row' }
          }}
        >
          {/* Left visual panel */}
          <Box
            sx={{
              flex: 1,
              position: 'relative',
              borderRadius: 3,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: { xs: 'center', md: 'flex-start' },
              px: { xs: 4, md: 6 },
              py: { xs: 6, md: 8 },
              color: 'black',
              backgroundColor: 'white',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
            }}
          >
            <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 420 }}>
              <Typography variant="h3" sx={{ fontWeight: 800, mb: 1.5 }}>
                Welcome back
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.95, mb: 2 }}>
                Manage buses, drivers and bookings from a single, secure admin portal.
              </Typography>
              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Chip label="Fast" sx={{ background: '#e0e0e0', fontWeight: '700' }} />
                <Chip label="Secure" sx={{ background: '#e0e0e0', fontWeight: '700' }} />
                <Chip label="Realtime" sx={{ background: '#e0e0e0', fontWeight: '700' }} />
              </Box>
            </Box>
          </Box>

          {/* Right form card */}
          <Paper
            elevation={20}
            sx={{
              width: '100%',
              maxWidth: 460,
              p: { xs: 3, sm: 4 },
              borderRadius: 3,
              mx: 'auto',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(250,250,255,0.96))',
              backdropFilter: 'saturate(120%) blur(6px)',
              boxShadow: '0 28px 80px rgba(20,25,60,0.18)',
              border: '1px solid rgba(102,126,234,0.06)',
              position: 'relative',
              zIndex: 2
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 2, background: 'linear-gradient(90deg,#667eea,#764ba2)', boxShadow: '0 6px 24px rgba(102,126,234,0.18)' }}>
                <AdminIcon sx={{ color: 'white', fontSize: 32 }} />
              </Box>
            </Box>
            <Typography component="h1" variant="h5" sx={{ fontWeight: 700, textAlign: 'center', mb: 0.5 }}>
              Admin Portal
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', mb: 2 }}>
              Sign in to manage the Bus Tracking & Booking System
            </Typography>

            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label="Email Address"
                name="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon sx={{ color: '#667eea' }} />
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                type="password"
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon sx={{ color: '#667eea' }} />
                    </InputAdornment>
                  ),
                }}
              />

              {error && (
                <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
                  {error}
                </Alert>
              )}

              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading}
                sx={{
                  mt: 3,
                  mb: 2,
                  py: 1.25,
                  background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
                  borderRadius: 2,
                  fontSize: '1rem',
                  fontWeight: 700,
                  textTransform: 'none',
                  boxShadow: '0 8px 30px rgba(102,126,234,0.18)',
                  '&:hover': { transform: 'translateY(-2px)' },
                  transition: 'all 0.25s ease'
                }}
              >
                {loading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CircularProgress size={20} sx={{ mr: 1, color: 'white' }} />
                    Signing in...
                  </Box>
                ) : (
                  'Sign in'
                )}
              </Button>

              <Divider sx={{ my: 3 }}>
                <Chip label="Default Credentials" sx={{ backgroundColor: '#f5f5f5' }} />
              </Divider>

              <Card sx={{ backgroundColor: '#f8f9ff', border: '1px solid #e0e7ff' }}>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1, color: '#4338ca' }}>
                    Test Admin Access
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#6b7280', mb: 0.5 }}>
                    <strong>Email:</strong> admin@bustrack.com
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#6b7280' }}>
                    <strong>Password:</strong> admin123
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          </Paper>
        </Box>
      </Box>
    </Container>
  );
};

export default Login;
