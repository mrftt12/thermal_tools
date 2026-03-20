import { useEffect, useRef, useState, useCallback } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import axios from "axios";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

// Pages
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import CableLibrary from "@/pages/CableLibrary";
import CableEditor from "@/pages/CableEditor";
import CalculationWizard from "@/pages/CalculationWizard";
import Results from "@/pages/Results";
import ProjectView from "@/pages/ProjectView";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Auth Context
import { createContext, useContext } from "react";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

// Auth Provider
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, { withCredentials: true });
      setUser(response.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // CRITICAL: If returning from OAuth callback, skip the /me check.
    // AuthCallback will exchange the session_id and establish the session first.
    if (window.location.hash?.includes('session_id=')) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const login = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    } catch (e) {
      console.error("Logout error:", e);
    }
    setUser(null);
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

// Auth Callback Component
const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      const hash = location.hash;
      const sessionId = new URLSearchParams(hash.substring(1)).get('session_id');
      
      if (!sessionId) {
        toast.error("Authentication failed");
        navigate('/');
        return;
      }

      try {
        const response = await axios.post(
          `${API}/auth/session`,
          { session_id: sessionId },
          { withCredentials: true }
        );
        setUser(response.data);
        toast.success(`Welcome, ${response.data.name}!`);
        navigate('/dashboard', { replace: true, state: { user: response.data } });
      } catch (error) {
        console.error("Auth error:", error);
        toast.error("Authentication failed. Please try again.");
        navigate('/');
      }
    };

    processAuth();
  }, [location, navigate, setUser]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-zinc-400 font-mono">Authenticating...</p>
      </div>
    </div>
  );
};

// Protected Route
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user && !location.state?.user) {
      navigate('/', { replace: true });
    }
  }, [loading, user, location, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-400 font-mono">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user && !location.state?.user) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// App Router
function AppRouter() {
  const location = useLocation();

  // Check URL fragment for session_id (synchronous check before render)
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/dashboard" element={
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      } />
      <Route path="/cables" element={
        <ProtectedRoute><CableLibrary /></ProtectedRoute>
      } />
      <Route path="/cables/new" element={
        <ProtectedRoute><CableEditor /></ProtectedRoute>
      } />
      <Route path="/cables/:cableId" element={
        <ProtectedRoute><CableEditor /></ProtectedRoute>
      } />
      <Route path="/calculate" element={
        <ProtectedRoute><CalculationWizard /></ProtectedRoute>
      } />
      <Route path="/calculate/:projectId" element={
        <ProtectedRoute><CalculationWizard /></ProtectedRoute>
      } />
      <Route path="/projects/:projectId" element={
        <ProtectedRoute><ProjectView /></ProtectedRoute>
      } />
      <Route path="/results/:projectId" element={
        <ProtectedRoute><Results /></ProtectedRoute>
      } />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster 
            position="top-right" 
            toastOptions={{
              style: {
                background: '#18181b',
                border: '1px solid #27272a',
                color: '#fafafa',
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
