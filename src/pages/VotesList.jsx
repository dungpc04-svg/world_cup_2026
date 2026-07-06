import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

export default function VotesList() {
  const [matches, setMatches] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [users, setUsers] = useState({});
  const [selectedMatchId, setSelectedMatchId] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'matches'), orderBy('kickoffAt', 'asc'));
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMatches(list);
      if (!selectedMatchId && list.length) setSelectedMatchId(list[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, 'predictions'), (snap) => {
      setPredictions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, 'users'), (snap) => {
      const map = {};
      snap.docs.forEach((d) => (map[d.id] = d.data()));
      setUsers(map);
    });
  }, []);

  const rows = useMemo(
    () => predictions.filter((p) => p.matchId === selectedMatchId),
    [predictions, selectedMatchId]
  );

  const selectedMatch = matches.find((m) => m.id === selectedMatchId);

  return (
    <div className="page-wrap">
      <h1>Danh sách bình chọn</h1>

      <select value={selectedMatchId} onChange={(e) => setSelectedMatchId(e.target.value)} style={{ marginBottom: 16 }}>
        {matches.map((m) => (
          <option key={m.id} value={m.id}>
            {m.homeTeam} vs {m.awayTeam}
          </option>
        ))}
      </select>

      <table className="table">
        <thead>
          <tr>
            <th>Người chơi</th>
            <th>Lựa chọn</th>
            <th>Tỷ số dự đoán</th>
            <th>Kèo tại thời điểm chọn</th>
            <th style={{ textAlign: 'right' }}>Điểm</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{users[r.userId]?.displayName || users[r.userId]?.username || r.userId}</td>
              <td>{r.noPick ? '—' : r.pickSide === 'home' ? selectedMatch?.homeTeam : selectedMatch?.awayTeam}</td>
              <td>{r.noPick ? 'Không dự đoán' : `${r.predictedHome}-${r.predictedAway}`}</td>
              <td>{r.noPick ? '—' : r.handicapAtPick}</td>
              <td style={{ textAlign: 'right' }}>{r.points ?? '—'}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="hint-text">
                Chưa có ai dự đoán trận này.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="hint-text">Cột điểm chỉ có giá trị sau khi quản trị viên chốt kết quả trận đấu.</p>
    </div>
  );
}
