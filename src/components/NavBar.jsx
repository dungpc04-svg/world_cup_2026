import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function NavBar() {
  const { profile, role, logout } = useAuth();

  return (
    <div className="navbar">
      <div className="navbar-links">
        <NavLink to="/vote" className={({ isActive }) => (isActive ? 'navlink active' : 'navlink')}>
          Bình chọn
        </NavLink>
        <NavLink to="/votes" className={({ isActive }) => (isActive ? 'navlink active' : 'navlink')}>
          Danh sách bình chọn
        </NavLink>
        <NavLink to="/leaderboard" className={({ isActive }) => (isActive ? 'navlink active' : 'navlink')}>
          Bảng xếp hạng
        </NavLink>
        {role === 'superadmin' && (
          <NavLink to="/admin" className={({ isActive }) => (isActive ? 'navlink active' : 'navlink')}>
            Quản trị
          </NavLink>
        )}
      </div>
      <div className="navbar-user">
        <span>{profile?.displayName || profile?.username}</span>
        <button onClick={logout}>Đăng xuất</button>
      </div>
    </div>
  );
}
