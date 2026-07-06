import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export default function Leaderboard() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const unsubLb = onSnapshot(collection(db, 'leaderboard'), (lbSnap) => {
      const unsubUsers = onSnapshot(collection(db, 'users'), (userSnap) => {
        const users = {};
        userSnap.docs.forEach((d) => (users[d.id] = d.data()));
        const list = lbSnap.docs.map((d) => ({
          uid: d.id,
          totalPoints: d.data().totalPoints ?? 0,
          name: users[d.id]?.displayName || users[d.id]?.username || d.id,
        }));
        list.sort((a, b) => a.totalPoints - b.totalPoints); // điểm phạt thấp nhất đứng đầu
        setRows(list);
      });
      return unsubUsers;
    });
    return unsubLb;
  }, []);

  return (
    <div className="page-wrap">
      <h1>Bảng xếp hạng</h1>
      <p className="hint-text">Điểm là điểm phạt — thấp hơn xếp hạng cao hơn.</p>
      {rows.map((r, i) => (
        <div className="card lb-row" key={r.uid}>
          <span className={`rank-badge ${i === 0 ? 'rank-first' : ''}`}>{i + 1}</span>
          <span style={{ flex: 1 }}>{r.name}</span>
          <b>{r.totalPoints.toFixed(2)} điểm</b>
        </div>
      ))}
      {rows.length === 0 && <p className="hint-text">Chưa có dữ liệu điểm.</p>}
    </div>
  );
}
