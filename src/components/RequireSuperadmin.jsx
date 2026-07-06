import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RequireSuperadmin({ children }) {
  const { role } = useAuth();
  if (role !== 'superadmin') return <Navigate to="/vote" replace />;
  return children;
}
