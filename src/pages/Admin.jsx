import { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { collection, onSnapshot, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, functions } from '../firebase';

const ROUND_OPTIONS = [
  { value: 'group', label: 'Vòng bảng' },
  { value: 'r32', label: 'Vòng 1/32' },
  { value: 'r16', label: 'Vòng 1/16 (bắt đầu x2 điểm)' },
  { value: 'qf', label: 'Tứ kết' },
  { value: 'sf', label: 'Bán kết' },
  { value: 'final', label: 'Chung kết' },
];

export default function Admin() {
  const [tab, setTab] = useState('users');
  return (
    <div className="page-wrap">
      <h1>Quản trị</h1>
      <div className="tab-row">
        <button className={tab === 'users' ? 'tab active' : 'tab'} onClick={() => setTab('users')}>
          Người dùng
        </button>
        <button className={tab === 'matches' ? 'tab active' : 'tab'} onClick={() => setTab('matches')}>
          Trận đấu &amp; kết quả
        </button>
      </div>
      {tab === 'users' ? <UserAdmin /> : <MatchAdmin />}
    </div>
  );
}

function UserAdmin() {
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => onSnapshot(collection(db, 'users'), (snap) => {
    setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }), []);

  async function handleCreate(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const createUser = httpsCallable(functions, 'createUser');
      const res = await createUser({ username: username.trim(), displayName: displayName.trim() });
      setMessage(`Đã tạo "${username}" — mật khẩu mặc định: ${res.data.defaultPassword}`);
      setUsername('');
      setDisplayName('');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleReset(uid) {
    const resetPw = httpsCallable(functions, 'resetPassword');
    const res = await resetPw({ uid });
    setMessage(`Đã đặt lại mật khẩu về: ${res.data.defaultPassword}`);
  }

  async function handleDelete(uid) {
    if (!confirm('Xóa người dùng này?')) return;
    const del = httpsCallable(functions, 'deleteUser');
    await del({ uid });
  }

  return (
    <div>
      <form className="card" onSubmit={handleCreate} style={{ marginBottom: 16 }}>
        <h2>Thêm người dùng mới</h2>
        <div className="predict-row">
          <input placeholder="Tên đăng nhập" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <input placeholder="Tên hiển thị" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <button className="btn-primary" disabled={busy} type="submit">
            Tạo (mật khẩu mặc định 123456)
          </button>
        </div>
        {message && <p className="hint-text">{message}</p>}
      </form>

      <table className="table">
        <thead>
          <tr>
            <th>Tên đăng nhập</th>
            <th>Tên hiển thị</th>
            <th>Vai trò</th>
            <th>Cần đổi mật khẩu</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.username}</td>
              <td>{u.displayName}</td>
              <td>{u.role}</td>
              <td>{u.mustChangePassword ? 'Có' : 'Không'}</td>
              <td style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleReset(u.id)}>Reset mật khẩu</button>
                {u.role !== 'superadmin' && <button onClick={() => handleDelete(u.id)}>Xóa</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchAdmin() {
  const [matches, setMatches] = useState([]);
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [kickoffAt, setKickoffAt] = useState('');
  const [handicapLine, setHandicapLine] = useState('');
  const [round, setRound] = useState('group');
  const [results, setResults] = useState({});
  const [message, setMessage] = useState('');

  useEffect(() => onSnapshot(collection(db, 'matches'), (snap) => {
    setMatches(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }), []);

  async function handleAddMatch(e) {
    e.preventDefault();
    await addDoc(collection(db, 'matches'), {
      homeTeam: homeTeam.trim(),
      awayTeam: awayTeam.trim(),
      kickoffAt: Timestamp.fromDate(new Date(kickoffAt)),
      handicapLine: Number(handicapLine),
      round,
      status: 'upcoming',
      createdAt: serverTimestamp(),
    });
    setHomeTeam('');
    setAwayTeam('');
    setKickoffAt('');
    setHandicapLine('');
  }

  async function handleSettle(matchId) {
    const r = results[matchId] || {};
    if (r.home === undefined || r.away === undefined) return;
    if (!confirm('Chốt kết quả sẽ tính điểm cho tất cả người chơi và không thể sửa dễ dàng. Tiếp tục?')) return;
    const settle = httpsCallable(functions, 'settleMatch');
    try {
      await settle({ matchId, homeGoals: Number(r.home), awayGoals: Number(r.away) });
      setMessage('Đã chốt kết quả và tính điểm.');
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <div>
      <form className="card" onSubmit={handleAddMatch} style={{ marginBottom: 16 }}>
        <h2>Thêm trận đấu</h2>
        <div className="predict-row">
          <input placeholder="Đội nhà" value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} required />
          <input placeholder="Đội khách" value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} required />
        </div>
        <div className="predict-row">
          <input type="datetime-local" value={kickoffAt} onChange={(e) => setKickoffAt(e.target.value)} required />
          <input
            type="number"
            step="0.25"
            placeholder="Kèo chấp (âm nếu đội nhà chấp)"
            value={handicapLine}
            onChange={(e) => setHandicapLine(e.target.value)}
            required
          />
          <select value={round} onChange={(e) => setRound(e.target.value)}>
            {ROUND_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-primary" type="submit">
          Thêm trận đấu
        </button>
      </form>

      {message && <p className="hint-text">{message}</p>}

      {matches.map((m) => (
        <div className="card" key={m.id} style={{ marginBottom: 12 }}>
          <div className="match-header">
            <span className="match-teams">
              {m.homeTeam} vs {m.awayTeam}
            </span>
            <span className="pill pill-gray">{ROUND_OPTIONS.find((r) => r.value === m.round)?.label}</span>
          </div>
          <p className="hint-text">
            Kèo: {m.handicapLine} · {m.kickoffAt?.toDate().toLocaleString('vi-VN')} · Trạng thái: {m.status}
          </p>
          {m.status !== 'finished' ? (
            <div className="predict-row">
              <input
                type="number"
                placeholder="Bàn nhà"
                style={{ width: 80 }}
                onChange={(e) => setResults((p) => ({ ...p, [m.id]: { ...p[m.id], home: e.target.value } }))}
              />
              <span>—</span>
              <input
                type="number"
                placeholder="Bàn khách"
                style={{ width: 80 }}
                onChange={(e) => setResults((p) => ({ ...p, [m.id]: { ...p[m.id], away: e.target.value } }))}
              />
              <button className="btn-primary" onClick={() => handleSettle(m.id)}>
                Chốt kết quả và tính điểm
              </button>
            </div>
          ) : (
            <p>
              Kết quả cuối: {m.finalHomeGoals}-{m.finalAwayGoals}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
