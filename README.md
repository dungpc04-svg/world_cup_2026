# Bình chọn kèo World Cup 2026

App bình chọn/dự đoán kết quả các trận World Cup 2026 theo kèo châu Á, tính điểm phạt tự động, có bảng xếp hạng và trang quản trị. Xây bằng React (Vite) + Firebase (Auth tùy chỉnh + Firestore + Cloud Functions).

## Tính năng

- **Đăng nhập bằng username/password riêng** (không phải email) — xác thực tùy chỉnh qua Cloud Function, không phụ thuộc giới hạn 6 ký tự của Firebase Auth.
- **Superadmin mặc định**: `admin` / `admin`. Bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên.
- **Quản trị người dùng**: superadmin tạo/sửa/xóa/reset mật khẩu (mặc định `123456`, cũng bắt buộc đổi ở lần đăng nhập đầu).
- **Bình chọn**: mỗi trận nhập tỷ số dự đoán + chọn kèo chấp, khóa lại sau giờ bóng lăn.
- **Danh sách bình chọn**: xem dự đoán của mọi người theo từng trận.
- **Bảng xếp hạng**: tổng điểm phạt, thấp nhất xếp hạng cao nhất.
- **Tính điểm tự động** theo kèo châu Á khi superadmin nhập kết quả thật (`functions/scoring.js`):

  | Kết quả kèo | Điểm phạt | Vòng 1/16 trở lên |
  |---|---|---|
  | Đúng (ăn trọn) | 0 | 0 |
  | Đúng nửa (ăn nửa) | 0.25 | 0.5 |
  | Hòa kèo (push) | 0.5 | 1 |
  | Sai nửa (thua nửa) | 0.7 | 1.4 |
  | Sai (thua trọn) | 1 | 2 |
  | Không dự đoán | 1 | 2 |

## Cấu trúc project

```
wc2026-vote-app/
  functions/          Cloud Functions (auth, quản lý user, tính điểm)
    index.js
    scoring.js        Logic tính kèo châu Á — có thể chạy độc lập để test
  src/
    pages/            Login, ChangePassword, Vote, VotesList, Leaderboard, Admin
    context/          AuthContext (đăng nhập, phiên làm việc)
    components/       NavBar, RequireSuperadmin
    firebase.js       Kết nối Firebase (đọc config từ .env)
  firestore.rules      Phân quyền Firestore
  firebase.json
```

## 1. Cài đặt

Yêu cầu: Node.js 20+, tài khoản Firebase (miễn phí là đủ), Firebase CLI.

```bash
npm install -g firebase-tools
firebase login

# Tạo project mới trên https://console.firebase.google.com, bật:
#   - Authentication (không cần bật provider nào — app tự quản lý qua Custom Token)
#   - Firestore Database
#   - Cloud Functions (cần gói Blaze — có hạn mức miễn phí hàng tháng)

git clone <repo-cua-ban>
cd wc2026-vote-app
firebase use --add          # chọn project Firebase vừa tạo

npm install                 # cài frontend
cd functions && npm install # cài Cloud Functions
cd ..
```

Copy `.env.example` thành `.env` và điền thông tin project (Project settings > Your apps > SDK config trên Firebase Console):

```bash
cp .env.example .env
```

## 2. Chạy thử bằng Firebase Emulator (khuyến nghị trước khi deploy thật)

```bash
# Sửa .env: VITE_USE_EMULATORS=true
firebase emulators:start        # chạy Auth + Firestore + Functions giả lập
npm run dev                     # chạy frontend, mở http://localhost:5173
```

## 3. Khởi tạo tài khoản superadmin mặc định

Sau khi deploy Functions (hoặc chạy emulator), gọi 1 lần endpoint sau (không cần đăng nhập) để tạo `admin`/`admin`:

```
GET https://<region>-<project-id>.cloudfunctions.net/seedSuperadmin
```

Trên emulator: `http://localhost:5001/<project-id>/us-central1/seedSuperadmin`

## 4. Deploy thật lên Firebase

```bash
firebase deploy --only firestore:rules,firestore:indexes,functions
npm run build
firebase deploy --only hosting
```

## 5. Đẩy code lên GitHub

```bash
git init
git add .
git commit -m "Khởi tạo app bình chọn World Cup 2026"
git branch -M main
git remote add origin https://github.com/<ten-tai-khoan>/<ten-repo>.git
git push -u origin main
```

> File `.env` đã được thêm vào `.gitignore` — không bao giờ commit thông tin Firebase API key thật kèm mã nguồn công khai nếu repo là public (dù key này không phải bí mật tuyệt đối, vẫn nên kiểm soát qua Firebase Security Rules là chính).

## 5b. Tự động deploy khi push lên GitHub (tuỳ chọn, dùng GitHub Actions)

Repo đã có sẵn `.github/workflows/deploy.yml` — mỗi lần push lên nhánh `main`, GitHub tự build và deploy lên Firebase. Cần khai báo Secrets trong repo GitHub (Settings > Secrets and variables > Actions > New repository secret):

| Tên secret | Lấy ở đâu |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase Console > Project settings > SDK config |
| `VITE_FIREBASE_AUTH_DOMAIN` | như trên |
| `VITE_FIREBASE_PROJECT_ID` | như trên |
| `VITE_FIREBASE_STORAGE_BUCKET` | như trên |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | như trên |
| `VITE_FIREBASE_APP_ID` | như trên |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Console > Project settings > Service accounts > Generate new private key (dán nguyên nội dung file JSON tải về) |

Nếu không muốn tự động hóa, bỏ qua mục này và deploy tay theo mục 6 bên dưới là đủ.

## 6. Về cập nhật kèo tự động từ nguồn ngoài (asianbookie.net)

Hàm `scheduledOddsUpdate` trong `functions/index.js` đã dựng sẵn khung chạy lịch **12:00 mỗi ngày (giờ Việt Nam)**, nhưng **đang tắt mặc định** vì:

1. Môi trường phát triển hiện tại không truy cập được `asianbookie.net` để kiểm tra cấu trúc trang thật, nên phần parse HTML chưa thể viết chính xác — bạn cần tự bổ sung theo đúng cấu trúc trang tại thời điểm triển khai.
2. Việc cào dữ liệu từ một trang kèo bên thứ ba có thể vi phạm điều khoản sử dụng của họ, và trang có thể chặn bot hoặc đổi cấu trúc bất kỳ lúc nào khiến hàm lỗi.

**Khuyến nghị**: dùng form "Thêm trận đấu" trong trang Quản trị để nhập kèo tay hàng ngày (mất 1-2 phút), ổn định và không phụ thuộc bên thứ ba. Nếu vẫn muốn tự động hóa, bật bằng cách set `config/oddsSource.enabled = true` trong Firestore và hoàn thiện phần `TODO` trong hàm `scheduledOddsUpdate`.

## 7. Kiểm thử nhanh logic tính điểm (không cần Firebase)

```bash
cd functions
node -e "
const s = require('./scoring.js');
console.log(s.settleAsianHandicap('home', -0.75, 2, 1)); // HALF_WIN
console.log(s.calcPoints('LOSS', 'r16'));                // 2 (x2 vì vòng 1/16)
"
```
