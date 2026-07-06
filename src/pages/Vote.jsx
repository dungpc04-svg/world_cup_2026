import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

export default function Vote() {
  const { profile } = useAuth();
  const [matches, setMatches] = useState([]);
  const [myPredictions, setMyPredictions] = useState({});
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'matches'), orderBy('kickoffAt', 'asc'));
    return onSnapshot(q, (snap) => {
      setMatches(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  useEffect(() => {
    if (!profile) return;
    return onSnapshot(collection(db, 'predictions'), (snap) => {
      const mine = {};
      snap.docs.forEach((d) => {
        const p = d.data();
        if (p.userId === profile.id) mine[p.matchId] = { id: d.id, ...p };
      });
      setMyPredictions(mine);
    });
  }, [profile]);

  function updateDraft(matchId, field, value) {
    setDrafts((prev) => ({ ...prev, [matchId]: { ...prev[matchId], [field]: value } }));
  }

  function isLocked(match) {
    if (match.status === 'finished' || match.status === 'locked') return true;
    if (!match.kickoffAt) return false;
    const kickoff = match.kickoffAt.toDate ? match.kickoffAt.toDate() : new Date(match.kickoffAt);
    return kickoff.getTime() <= Date.now();
  }

  async function submitPrediction(match) {
    const draft = drafts[match.id] || {};
    const existing = myPredictions[match.id];
    const pickSide = draft.pickSide ?? existing?.pickSide ?? 'home';
    const predictedHome = draft.predictedHome ?? existing?.predictedHome ?? 0;
    const predictedAway = draft.predictedAway ?? existing?.predictedAway ?? 0;

    setSavingId(match.id);
    try {
      const predId = `${match.id}_${profile.id}`;
      await setDoc(doc(db, 'predictions', predId), {
        matchId: match.id,
        userId: profile.id,
        pickSide,
        predictedHome: Number(predictedHome),
        predictedAway: Number(predictedAway),
        handicapAtPick: match.handicapLine ?? 0,
        submittedAt: serverTimestamp(),
      });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="page-wrap">
      <h1>Bình chọn</h1>
      <p className="hint-text">Nhập dự đoán trước giờ bóng lăn. Kèo chấp được khóa theo thời điểm gửi dự đoán.</p>

      {matches.length === 0 && <p className="hint-text">Chưa có trận đấu nào, chờ quản trị viên thêm.</p>}

      {matches.map((match) => {
        const locked = isLocked(match);
        const existing = myPredictions[match.id];
        const draft = drafts[match.id] || {};
        const pickSide = draft.pickSide ?? existing?.pickSide ?? 'home';
        const predictedHome = draft.predictedHome ?? existing?.predictedHome ?? '';
        const predictedAway = draft.predictedAway ?? existing?.predictedAway ?? '';

        return (
          <div className="card match-card" key={match.id}>
            <div className="match-header">
              <span className="match-teams">
                {match.homeTeam} vs {match.awayTeam}
              </span>
              <span className={`pill ${locked ? 'pill-gray' : 'pill-amber'}`}>
                {match.status === 'finished' ? 'Đã kết thúc' : locked ? 'Đã khóa' : existing ? 'Đã gửi dự đoán' : 'Chưa dự đoán'}
              </span>
            </div>
            <p className="hint-text">
              Kèo chấp hiện tại: {match.handicapLine ?? '—'} · Giờ bóng lăn:{' '}
              {match.kickoffAt?.toDate ? match.kickoffAt.toDate().toLocaleString('vi-VN') : '—'}
            </p>

            <div className="predict-row">
              <select value={pickSide} onChange={(e) => updateDraft(match.id, 'pickSide', e.target.value)} disabled={locked}>
                <option value="home">{match.homeTeam} chấp</option>
                <option value="away">{match.awayTeam} chấp</option>
              </select>
              <input
                type="number"
                min="0"
                placeholder="Bàn nhà"
                value={predictedHome}
                onChange={(e) => updateDraft(match.id, 'predictedHome', e.target.value)}
                disabled={locked}
                style={{ width: 70 }}
              />
              <span>—</span>
              <input
                type="number"
                min="0"
                placeholder="Bàn khách"
                value={predictedAway}
                onChange={(e) => updateDraft(match.id, 'predictedAway', e.target.value)}
                disabled={locked}
                style={{ width: 70 }}
              />
            </div>

            {match.status === 'finished' && existing && (
              <p className="hint-text">
                Kết quả: {match.finalHomeGoals}-{match.finalAwayGoals} · Điểm phạt của bạn: <b>{existing.points}</b>
              </p>
            )}

            <button
              className="btn-primary"
              disabled={locked || savingId === match.id}
              onClick={() => submitPrediction(match)}
            >
              {savingId === match.id ? 'Đang lưu…' : existing ? 'Cập nhật dự đoán' : 'Gửi dự đoán'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
