const functions = require('firebase-functions');
const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');
const { settleAsianHandicap, calcPoints } = require('./scoring');

admin.initializeApp();
const db = admin.firestore();

const DEFAULT_PASSWORD = '123456';
const SALT_ROUNDS = 10;

// ---------- Helpers ----------

async function requireSuperadmin(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Bạn cần đăng nhập.');
  }
  const snap = await db.collection('users').doc(context.auth.uid).get();
  if (!snap.exists || snap.data().role !== 'superadmin') {
    throw new functions.https.HttpsError('permission-denied', 'Chỉ superadmin được thực hiện thao tác này.');
  }
  return snap;
}

function hash(pw) {
  return bcrypt.hashSync(pw, SALT_ROUNDS);
}

// ---------- Khởi tạo superadmin mặc định (chạy 1 lần thủ công, xem README) ----------

exports.seedSuperadmin = functions.https.onRequest(async (req, res) => {
  const existing = await db.collection('users').where('username', '==', 'admin').limit(1).get();
  if (!existing.empty) {
    res.status(200).send('Tài khoản admin đã tồn tại, bỏ qua.');
    return;
  }
  const uid = 'superadmin-default';
  await admin.auth().createUser({ uid, displayName: 'Super Admin' }).catch((e) => {
    if (e.code !== 'auth/uid-already-exists') throw e;
  });
  await db.collection('users').doc(uid).set({
    username: 'admin',
    displayName: 'Super Admin',
    role: 'superadmin',
    passwordHash: hash('admin'),
    mustChangePassword: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  res.status(200).send('Đã tạo superadmin mặc định: admin / admin (sẽ bị bắt đổi mật khẩu ở lần đăng nhập đầu).');
});

// ---------- Đăng nhập tùy chỉnh (username/password, không phụ thuộc độ dài mật khẩu của Firebase Auth) ----------

exports.login = functions.https.onCall(async (data) => {
  const { username, password } = data;
  if (!username || !password) {
    throw new functions.https.HttpsError('invalid-argument', 'Thiếu tên đăng nhập hoặc mật khẩu.');
  }
  const q = await db.collection('users').where('username', '==', username).limit(1).get();
  if (q.empty) {
    throw new functions.https.HttpsError('not-found', 'Sai tên đăng nhập hoặc mật khẩu.');
  }
  const userDoc = q.docs[0];
  const user = userDoc.data();
  if (!bcrypt.compareSync(password, user.passwordHash)) {
    throw new functions.https.HttpsError('unauthenticated', 'Sai tên đăng nhập hoặc mật khẩu.');
  }
  const token = await admin.auth().createCustomToken(userDoc.id, { role: user.role });
  return {
    token,
    mustChangePassword: !!user.mustChangePassword,
    role: user.role,
    displayName: user.displayName || user.username,
  };
});

// ---------- Đổi mật khẩu (bắt buộc ở lần đăng nhập đầu, hoặc tự đổi sau này) ----------

exports.changePassword = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Bạn cần đăng nhập.');
  }
  const { currentPassword, newPassword } = data;
  if (!newPassword || newPassword.length < 6) {
    throw new functions.https.HttpsError('invalid-argument', 'Mật khẩu mới phải từ 6 ký tự.');
  }
  const ref = db.collection('users').doc(context.auth.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', 'Không tìm thấy tài khoản.');
  }
  const user = snap.data();
  if (!bcrypt.compareSync(currentPassword || '', user.passwordHash)) {
    throw new functions.https.HttpsError('unauthenticated', 'Mật khẩu hiện tại không đúng.');
  }
  await ref.update({
    passwordHash: hash(newPassword),
    mustChangePassword: false,
  });
  return { ok: true };
});

// ---------- Quản trị người dùng (chỉ superadmin) ----------

exports.createUser = functions.https.onCall(async (data, context) => {
  await requireSuperadmin(context);
  const { username, displayName, role } = data;
  if (!username) {
    throw new functions.https.HttpsError('invalid-argument', 'Thiếu tên đăng nhập.');
  }
  const existing = await db.collection('users').where('username', '==', username).limit(1).get();
  if (!existing.empty) {
    throw new functions.https.HttpsError('already-exists', 'Tên đăng nhập đã tồn tại.');
  }
  const authUser = await admin.auth().createUser({ displayName: displayName || username });
  await db.collection('users').doc(authUser.uid).set({
    username,
    displayName: displayName || username,
    role: role === 'superadmin' ? 'superadmin' : 'user',
    passwordHash: hash(DEFAULT_PASSWORD),
    mustChangePassword: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { uid: authUser.uid, defaultPassword: DEFAULT_PASSWORD };
});

exports.updateUser = functions.https.onCall(async (data, context) => {
  await requireSuperadmin(context);
  const { uid, displayName, role } = data;
  if (!uid) throw new functions.https.HttpsError('invalid-argument', 'Thiếu uid.');
  const patch = {};
  if (displayName !== undefined) patch.displayName = displayName;
  if (role !== undefined) patch.role = role === 'superadmin' ? 'superadmin' : 'user';
  await db.collection('users').doc(uid).update(patch);
  return { ok: true };
});

exports.deleteUser = functions.https.onCall(async (data, context) => {
  await requireSuperadmin(context);
  const { uid } = data;
  if (!uid) throw new functions.https.HttpsError('invalid-argument', 'Thiếu uid.');
  await db.collection('users').doc(uid).delete();
  await admin.auth().deleteUser(uid).catch(() => {});
  return { ok: true };
});

exports.resetPassword = functions.https.onCall(async (data, context) => {
  await requireSuperadmin(context);
  const { uid } = data;
  if (!uid) throw new functions.https.HttpsError('invalid-argument', 'Thiếu uid.');
  await db.collection('users').doc(uid).update({
    passwordHash: hash(DEFAULT_PASSWORD),
    mustChangePassword: true,
  });
  return { ok: true, defaultPassword: DEFAULT_PASSWORD };
});

// ---------- Chốt kết quả trận đấu & tính điểm ----------

exports.settleMatch = functions.https.onCall(async (data, context) => {
  await requireSuperadmin(context);
  const { matchId, homeGoals, awayGoals } = data;
  if (!matchId || homeGoals === undefined || awayGoals === undefined) {
    throw new functions.https.HttpsError('invalid-argument', 'Thiếu dữ liệu kết quả trận đấu.');
  }

  const matchRef = db.collection('matches').doc(matchId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Không tìm thấy trận đấu.');
  }
  const match = matchSnap.data();

  const predsSnap = await db.collection('predictions').where('matchId', '==', matchId).get();
  const predictedUserIds = new Set(predsSnap.docs.map((d) => d.data().userId));

  const allUsersSnap = await db.collection('users').get();

  const batch = db.batch();

  predsSnap.docs.forEach((doc) => {
    const pred = doc.data();
    const outcome = settleAsianHandicap(pred.pickSide, pred.handicapAtPick, homeGoals, awayGoals);
    const points = calcPoints(outcome, match.round);
    batch.update(doc.ref, { outcome, points, settledAt: admin.firestore.FieldValue.serverTimestamp() });
    batch.set(
      db.collection('leaderboard').doc(pred.userId),
      { totalPoints: admin.firestore.FieldValue.increment(points) },
      { merge: true }
    );
  });

  allUsersSnap.docs.forEach((userDoc) => {
    if (predictedUserIds.has(userDoc.id)) return;
    const points = calcPoints(null, match.round);
    const noPickRef = db.collection('predictions').doc(`${matchId}_${userDoc.id}`);
    batch.set(noPickRef, {
      matchId,
      userId: userDoc.id,
      pickSide: null,
      outcome: null,
      points,
      noPick: true,
      settledAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batch.set(
      db.collection('leaderboard').doc(userDoc.id),
      { totalPoints: admin.firestore.FieldValue.increment(points) },
      { merge: true }
    );
  });

  batch.update(matchRef, {
    status: 'finished',
    finalHomeGoals: homeGoals,
    finalAwayGoals: awayGoals,
    settledAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await batch.commit();
  return { ok: true };
});

// ---------- (Tùy chọn) Cập nhật kèo tự động lúc 12h mỗi ngày ----------
// TẮT MẶC ĐỊNH — xem README mục "Cập nhật kèo tự động" trước khi bật.
// Việc cào dữ liệu từ trang bên thứ ba có thể vi phạm điều khoản sử dụng của họ
// và cấu trúc trang có thể thay đổi bất kỳ lúc nào khiến hàm này lỗi.
// Bạn cần tự bổ sung phần parse HTML đúng với cấu trúc thật của nguồn dữ liệu.

exports.scheduledOddsUpdate = functions.pubsub
  .schedule('0 12 * * *')
  .timeZone('Asia/Ho_Chi_Minh')
  .onRun(async () => {
    const configSnap = await db.collection('config').doc('oddsSource').get();
    const config = configSnap.exists ? configSnap.data() : {};
    if (!config.enabled) {
      console.log('scheduledOddsUpdate: đang tắt (config/oddsSource.enabled = false). Bỏ qua.');
      return null;
    }

    // TODO: thay bằng logic fetch + parse thật theo cấu trúc trang nguồn.
    // const res = await fetch(config.sourceUrl);
    // const html = await res.text();
    // const parsedMatches = parseOddsHtml(html); // <-- bạn tự viết hàm này
    // for (const m of parsedMatches) {
    //   await db.collection('matches').doc(m.id).set({
    //     handicapLine: m.handicapLine,
    //     ouLine: m.ouLine,
    //     oddsLockedAt: admin.firestore.FieldValue.serverTimestamp(),
    //   }, { merge: true });
    // }

    console.log('scheduledOddsUpdate: chưa cấu hình parser thật, xem TODO trong functions/index.js');
    return null;
  });
