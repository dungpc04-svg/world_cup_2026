import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err.message.replace('Firebase: ', '').replace(/\(.*\)\.?/, '').trim() || 'Đăng nhập thất bại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h1>Đăng nhập bình chọn WC 2026</h1>
        <label>Tên đăng nhập</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
        <label>Mật khẩu</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="error-text">{error}</p>}
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
        <p className="hint-text">Tài khoản do quản trị viên cấp. Mật khẩu mặc định: 123456</p>
      </form>
    </div>
  );
}
