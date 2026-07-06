import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { useAuth } from '../context/AuthContext';

export default function ChangePassword({ forced = false }) {
  const { setMustChangePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải từ 6 ký tự.');
      return;
    }
    setLoading(true);
    try {
      const changePw = httpsCallable(functions, 'changePassword');
      await changePw({ currentPassword, newPassword });
      setOk(true);
      setMustChangePassword(false);
    } catch (err) {
      setError(err.message.replace('Firebase: ', '').replace(/\(.*\)\.?/, '').trim() || 'Có lỗi xảy ra.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h1>{forced ? 'Cần đổi mật khẩu để tiếp tục' : 'Đổi mật khẩu'}</h1>
        {forced && <p className="hint-text">Đây là lần đăng nhập đầu tiên. Vui lòng đặt mật khẩu riêng của bạn.</p>}
        <label>Mật khẩu hiện tại</label>
        <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        <label>Mật khẩu mới</label>
        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
        <label>Nhập lại mật khẩu mới</label>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        {error && <p className="error-text">{error}</p>}
        {ok && <p className="success-text">Đổi mật khẩu thành công.</p>}
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? 'Đang lưu…' : 'Xác nhận đổi mật khẩu'}
        </button>
      </form>
    </div>
  );
}
