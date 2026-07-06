import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import NavBar from './components/NavBar';
import RequireSuperadmin from './components/RequireSuperadmin';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Vote from './pages/Vote';
import VotesList from './pages/VotesList';
import Leaderboard from './pages/Leaderboard';
import Admin from './pages/Admin';

function Gate() {
  const { loading, firebaseUser, mustChangePassword } = useAuth();

  if (loading) return <div className="page-wrap">Đang tải…</div>;
  if (!firebaseUser) return <Login />;
  if (mustChangePassword) return <ChangePassword forced />;

  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/vote" element={<Vote />} />
        <Route path="/votes" element={<VotesList />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route
          path="/admin"
          element={
            <RequireSuperadmin>
              <Admin />
            </RequireSuperadmin>
          }
        />
        <Route path="*" element={<Navigate to="/vote" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </AuthProvider>
  );
}
