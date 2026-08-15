# Hướng dẫn cài đặt chi tiết — Marketing OS Kitachi

Đọc từ trên xuống, làm theo đúng thứ tự. Mỗi bước đều mô tả bạn sẽ **thấy gì**
trên màn hình để biết mình đang đi đúng.

Chuẩn bị: máy tính, trình duyệt Chrome, một tài khoản Google. Khoảng 45 phút.

---

# GIAI ĐOẠN A · XEM THỬ TRƯỚC (2 phút)

Làm bước này trước để biết mình sắp cài cái gì.

**A1.** Tải file `kitachi-marketing-os.zip` về máy.

**A2.** Bấm chuột phải vào file → **Extract All** (Windows) hoặc bấm đúp (Mac).
Sẽ ra thư mục tên `mkt-os`.

**A3.** Mở thư mục `mkt-os`, bấm đúp vào file **`index.html`**.
Chrome sẽ mở ra.

**Bạn sẽ thấy:** màn hình tím có ô "Marketing OS", bên dưới là 5 tên người.

**A4.** Bấm vào tên **Công Tuân**, gõ PIN `1111`, bấm **Đăng nhập**.

**Bạn sẽ thấy:** Trang chủ với dải màu tím "Chào buổi sáng/chiều, Công Tuân",
bên dưới là các ô số liệu. Bên trái là thanh menu dài.
Dưới cùng màn hình có dải màu tím đậm ghi "Chế độ xem thử".

**A5.** Bấm thử vài mục trong menu bên trái để xem qua. Xong thì bấm biểu tượng
mũi tên ở góc dưới bên trái để đăng xuất, thử đăng nhập bằng người khác:

| Người | PIN | Vai trò |
|---|---|---|
| Công Tuân | 1111 | Leader Team |
| Trang Linh | 2222 | Content Marketing (chung) |
| Hồng Hạnh | 3333 | Content Marketing TikTok |
| Phạm Vỹ | 4444 | Designer |
| Diệu Thảo | 5555 | Editor |

M��i người vào sẽ thấy khác nhau — đó là điều đúng.

> **Lưu ý:** ở chế độ này dữ liệu chỉ nằm trong máy bạn. Tải lại trang là mất hết,
> và người khác mở sẽ không thấy gì bạn nhập. Muốn cả phòng dùng chung thì làm tiếp
> Giai đoạn B.

---

# GIAI ĐOẠN B · TẠO NƠI CHỨA DỮ LIỆU (15 phút)

Đây là bước quan trọng nhất. Làm chậm và cẩn thận.

## B1 · Đăng ký Supabase

**B1.1** Mở tab mới, vào địa chỉ: `supabase.com`

**B1.2** Bấm nút xanh **Start your project** ở giữa trang.

**B1.3** Chọn **Continue with Google** → chọn tài khoản Gmail của bạn.

**Bạn sẽ thấy:** trang trắng có chữ "Welcome to Supabase" hoặc danh sách project trống.

## B2 · Tạo project

**B2.1** Bấm nút **New project** (màu xanh lá).

**B2.2** Điền form:

| Ô | Điền gì |
|---|---|
| Organization | để nguyên cái có sẵn |
| Name | `kitachi-marketing` |
| Database Password | bấm **Generate a password** rồi bấm **Copy** |
| Region | bấm vào ô, chọn **Southeast Asia (Singapore)** |
| Pricing Plan | để **Free** |

> **Quan trọng:** mật khẩu vừa copy, dán vào Notepad lưu lại. Bạn không dùng nó để
> đăng nhập app, nhưng sau này cần nếu muốn khôi phục dữ liệu.

**B2.3** Bấm **Create new project**.

**Bạn sẽ thấy:** vòng tròn xoay và chữ "Setting up your project". Đợi khoảng 2 phút.
Đừng tắt tab.

## B3 · Chạy file thứ nhất: tạo bảng

**B3.1** Nhìn menu dọc bên trái, tìm biểu tượng **SQL Editor**
(hình tờ giấy có chữ SQL). Bấm vào.

**B3.2** Bấm nút **New query** ở góc trên bên trái vùng làm việc.

**Bạn sẽ thấy:** một ô đen lớn để gõ chữ.

**B3.3** Quay lại thư mục `mkt-os` trên máy, mở thư mục con **`supabase`**,
bấm chuột phải vào file **`schema.sql`** → **Open with** → **Notepad**.

> Nếu không thấy Notepad, chọn **Choose another app** → **Notepad**.
> Đừng mở bằng Word.

**B3.4** Trong Notepad: bấm Ctrl+A (chọn hết) rồi Ctrl+C (copy).

**B3.5** Quay lại tab Supabase, bấm vào ô đen, bấm Ctrl+V (dán).

**Bạn sẽ thấy:** rất nhiều dòng chữ, bắt đầu bằng `-- ═══...`

**B3.6** Bấm nút **Run** màu xanh ở góc dưới bên phải (hoặc nhấn Ctrl+Enter).

**Bạn sẽ thấy:** ở dưới hiện chữ **Success. No rows returned**.
Nếu thấy chữ đỏ ERROR thì dừng lại, chụp màn hình.

## B4 · Chạy file thứ hai: nạp dữ liệu

**B4.1** Bấm lại **New query** để mở ô trống mới.

**B4.2** Mở file **`seed.sql`** trong thư mục `supabase` bằng Notepad.
Ctrl+A rồi Ctrl+C.

**B4.3** Dán vào ô đen, bấm **Run**.

**Bạn sẽ thấy:** **Success. No rows returned**. Lần này chạy lâu hơn, khoảng 5 giây.

> **Nếu báo lỗi "duplicate key value"** — nghĩa là bạn đã chạy file này rồi.
> Không sao, chuyển sang B5 kiểm tra.

## B5 · Kiểm tra dữ liệu đã vào chưa

**B5.1** Menu trái → bấm **Table Editor** (hình cái bảng).

**Bạn sẽ thấy:** cột bên trái liệt kê 18 bảng: `activity`, `ads`, `approvals`,
`budget`, `channels`, `docs`, `duty`, `kudos`, `meetings`, `members`, `perms`,
`posts`, `projects`, `reports`, `risks`, `roles`, `settings`, `sprints`, `tasks`.

**B5.2** Bấm vào từng bảng dưới đây và nhìn góc dưới màn hình xem số dòng:

| Bảng | Phải có |
|---|---|
| `members` | 5 rows |
| `channels` | 12 rows |
| `tasks` | 235 rows |
| `posts` | 14 rows |
| `perms` | 22 rows |

**Nếu đủ cả 5 con số → xong phần khó nhất.**

Nếu thiếu hoặc sai: quay lại B3, chạy lại `schema.sql` (file này tự xoá bảng cũ),
rồi chạy `seed.sql` đúng **một lần**.

---

# GIAI ĐOẠN C · NỐI APP VỚI DỮ LIỆU (5 phút)

## C1 · Lấy hai chuỗi khoá

**C1.1** Trong Supabase, nhìn menu trái, kéo xuống dưới cùng, bấm biểu tượng
**bánh răng** (Project Settings).

**C1.2** Trong menu con hiện ra, bấm **Data API**.

**Bạn sẽ thấy:** trang có mục **Project URL** và mục **Project API keys**.

**C1.3** Ở mục **Project URL**, có một dòng dạng `https://abcdxyz.supabase.co`.
Bấm nút copy bên cạnh.

**C1.4** Mở Notepad, dán vào, ghi chú "URL". Chưa đóng Notepad.

**C1.5** Kéo xuống mục **Project API keys**. Có hai khoá:

- Dòng ghi **`anon` `public`** ← **lấy dòng này**
- Dòng ghi **`service_role` `secret`** ← **KHÔNG lấy dòng này**

Bấm nút copy ở dòng **anon public**.

**C1.6** Dán vào Notepad, ghi chú "KEY".

> **Vì sao không dùng service_role:** khoá đó có toàn quyền xoá sạch cơ sở dữ liệu.
> Vì file cấu hình đi kèm web nên ai mở web cũng đọc được. Chỉ dùng `anon public`.

## C2 · Dán vào file config.js

**C2.1** Về thư mục `mkt-os`, bấm chuột phải file **`config.js`** →
**Open with** → **Notepad**.

**Bạn sẽ thấy:**
```js
const CONFIG = {
  SUPABASE_URL:      "https://xxxxxxxxxxxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi....dán_khoá_anon_vào_đây"
};
```

**C2.2** Bôi đen phần `https://xxxxxxxxxxxxx.supabase.co` (chỉ phần chữ,
**không bôi hai dấu ngoặc kép**), dán URL vào thay.

**C2.3** Bôi đen phần `eyJhbGciOi....dán_khoá_anon_vào_đây` (cũng không bôi
dấu ngoặc kép), dán KEY vào thay.

**Kết quả phải trông như:**
```js
const CONFIG = {
  SUPABASE_URL:      "https://abcdxyz.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi..."
};
```

Còn đủ: hai dấu ngoặc kép mỗi dòng, dấu phẩy cuối dòng đầu, dấu chấm phẩy cuối.

**C2.4** Bấm Ctrl+S để lưu. Đóng Notepad.

## C3 · Kiểm tra đã nối được chưa

**C3.1** Bấm đúp `index.html` để mở lại bằng Chrome.
Nếu đang mở sẵn thì nhấn **Ctrl+Shift+R**.

**C3.2** Nhìn xuống **đáy màn hình**:

- **Không còn dải màu tím "Chế độ xem thử"** → thành công
- **Vẫn còn dải đó** → chưa nối được, xem lại C2

**C3.3** Đăng nhập lại, vào mục **Thành viên** — nếu thấy đủ 5 người thì dữ liệu
đang đọc từ Supabase thật.

---

# GIAI ĐOẠN D · ĐƯA LÊN MẠNG CHO CẢ PHÒNG (15 phút)

Đến đây app đã chạy nhưng chỉ trên máy bạn. Cần đưa lên mạng để cả phòng vào được.

## D1 · Tạo kho chứa mã trên GitHub

**D1.1** Vào `github.com`, bấm **Sign up** nếu chưa có tài khoản.

**D1.2** Đăng nhập xong, bấm dấu **`+`** ở góc phải trên → **New repository**.

**D1.3** Điền:

| Ô | Điền gì |
|---|---|
| Repository name | `kitachi-marketing-os` |
| Description | để trống |
| Public / Private | **chọn Private** |
| Add a README file | **không tích** |

> **Bắt buộc chọn Private** vì file `config.js` chứa khoá kết nối.

**D1.4** Bấm **Create repository**.

**Bạn sẽ thấy:** trang hướng dẫn có nhiều dòng lệnh. Bỏ qua hết.

## D2 · Tải file lên

**D2.1** Tìm dòng chữ xanh **uploading an existing file**, bấm vào.

**Bạn sẽ thấy:** khung lớn ghi "Drag files here to add them to your repository".

**D2.2** Mở thư mục `mkt-os` trên máy. Bấm Ctrl+A để chọn **tất cả file bên trong**.

> **Rất quan trọng:** vào **bên trong** thư mục `mkt-os` rồi chọn hết,
> **không** chọn cả thư mục `mkt-os` từ ngoài. Nếu làm sai, web sẽ ra trang trắng.

**D2.3** Kéo tất cả thả vào khung trên GitHub.

**Bạn sẽ thấy:** danh sách file đang tải lên: `app.js`, `config.js`, `demo-data.js`,
`index.html`, `style.css`, `vercel.json`, `README.md`, `SETUP.md`, `VAN-HANH.md`.

**D2.4** Kiểm tra thư mục `supabase` đã lên chưa. Nếu chưa, kéo riêng thư mục đó vào.

**D2.5** Kéo xuống dưới, ô **Commit changes** ghi: `Phien ban dau tien`.
Bấm nút xanh **Commit changes**.

**D2.6** Kiểm tra: trang repo phải liệt kê `index.html` ngay ngoài cùng,
**không** nằm trong thư mục con nào.

## D3 · Đưa lên Vercel

**D3.1** Vào `vercel.com`, bấm **Sign Up**.

**D3.2** Chọn **Continue with GitHub** → bấm **Authorize Vercel**.

**D3.3** Vào địa chỉ `vercel.com/new`.

**Bạn sẽ thấy:** danh sách repository GitHub của bạn.

**D3.4** Tìm `kitachi-marketing-os`, bấm nút **Import** bên cạnh.

> **Nếu không thấy repo:** kéo xuống cuối danh sách, bấm
> **Adjust GitHub App Permissions** → chọn **Only select repositories** →
> tick `kitachi-marketing-os` → **Save**.

**D3.5** Trang cấu hình hiện ra. Để nguyên hết:

| Ô | Để thế nào |
|---|---|
| Project Name | để nguyên |
| Framework Preset | **Other** |
| Root Directory | `./` |
| Build Command | **để trống** |
| Output Directory | **để trống** |
| Install Command | **để trống** |

**D3.6** Bấm nút đen **Deploy**.

**Bạn sẽ thấy:** màn hình có hình pháo hoa và chữ **Congratulations**.
Đợi khoảng 30 giây.

**D3.7** Bấm nút **Continue to Dashboard**. Ở đầu trang có địa chỉ dạng
`kitachi-marketing-os.vercel.app`. Bấm vào để mở.

**D3.8** Kiểm tra: app hiện ra, đăng nhập được, không có dải "Chế độ xem thử".

**Đây là link gửi cho cả phòng.**

---

# GIAI ĐOẠN E · CHUẨN BỊ DỮ LIỆU THẬT (30 phút)

App đang chạy với dữ liệu mẫu. Trước khi cả phòng dùng, cần thay bằng số thật.

## E1 · Đổi mã PIN (bắt buộc)

**E1.1** Vào app bằng Công Tuân / `1111`.

**E1.2** Menu trái → nhóm **Đội ngũ** → **Thành viên**.

**E1.3** Bấm vào dòng đầu tiên (Công Tuân). Ngăn kéo mở ra bên phải.

**E1.4** Tìm ô **Mã PIN**, đổi `1111` thành số khác. Bấm **Lưu thay đổi**.

**E1.5** Làm tương tự cho 4 người còn lại. Báo PIN mới cho từng người.

## E2 · Cập nhật thông tin kênh

**E2.1** Menu trái → **Kênh & chỉ số**.

**E2.2** Mỗi kênh có nút **Cấu hình**. Bấm vào và cập nhật:

- **Số follow hiện tại** — vào từng nền tảng xem con số thật
- **Mục tiêu bài mỗi tuần** — đặt đúng năng lực phòng, đừng đặt cao quá
- **Phụ trách nội dung** và **Phụ trách thiết kế**
- **Ngân sách quảng cáo tháng** — nếu kênh đó không chạy quảng cáo thì để 0

**E2.3** Kênh nào phòng không vận hành: bấm **Cấu hình** → **Xoá kênh**.

**E2.4** Kênh còn thiếu: bấm **Thêm kênh** ở góc phải trên.

## E3 · Chốt các mốc thời gian

**E3.1** Menu trái → nhóm **Hệ thống** → **Cài đặt**.

**E3.2** Điền **Ngày khai trương cơ sở 2** chính xác.
Toàn bộ hạn trong hệ thống tính ngược từ ngày này.

**E3.3** Ba ngưỡng nhắc việc, để mặc định cũng được:
- Nhắc khi bài chờ duyệt quá **2 ngày**
- Nhắc khi thiết kế trễ quá **3 ngày**
- Ngưỡng báo quá tải **14 việc/người**

**E3.4** Bấm **Lưu cài đặt**.

## E4 · Dọn dữ liệu mẫu

Dữ liệu mẫu gồm 14 bài đăng, 9 chiến dịch quảng cáo, 20 báo cáo ngày,
5 ghi nhận đồng đội. Cần xoá trước khi dùng thật.

**Cách nhanh** — Supabase → SQL Editor → New query → dán đoạn này → Run:

```sql
delete from activity;
delete from reports;
delete from kudos;
delete from duty;
delete from approvals;
delete from posts;
delete from ads;
```

> **Giữ lại bảng `tasks`** — 235 đầu việc trong đó là kế hoạch khai trương cơ sở 2
> thật, dùng được ngay. Nếu muốn xoá cả thì thêm dòng `delete from tasks;`

**Cách chậm mà chắc** — vào từng mục trong app, mở chi tiết, bấm **Lưu trữ**.
Cách này khôi phục lại được nếu lỡ tay, xem ở mục **Lưu trữ**.

## E5 · Nhập việc thật đầu tiên

**E5.1** Bấm nút **Tạo mới** ở góc phải trên → chọn **Bài đăng**.

**E5.2** Chọn kênh trước — biểu mẫu sẽ tự đổi theo nền tảng.
TikTok hỏi hook và nhạc trend, Facebook hỏi caption và ngân sách boost,
Google Maps hỏi nút hành động và ngày hết hạn ưu đãi.

**E5.3** Điền và bấm **Tạo nội dung**.

**E5.4** Vào **Content Marketing** kiểm tra bài vừa tạo đã hiện chưa.

---

# GIAI ĐOẠN F · MỜI CẢ PHÒNG VÀO (10 phút)

**F1.** Gửi cho từng người ba thứ:
- Link `https://kitachi-marketing-os.vercel.app`
- Tên đăng nhập (chính là tên họ)
- Mã PIN riêng

**F2.** Hướng dẫn mỗi người:
- Mở link trên điện thoại, bấm **Chia sẻ** → **Thêm vào màn hình chính**
  để dùng như một ứng dụng
- Đăng nhập lần đầu, app sẽ nhớ, lần sau vào thẳng

**F3.** Họp 30 phút với cả phòng, mở file `VAN-HANH.md` chiếu lên, thống nhất:
- Sáng mở Trang chủ
- Làm xong chặng nào đổi chặng ngay
- Cuối ngày nộp báo cáo

**F4.** Tuần đầu chỉ dùng ba màn hình: bàn làm việc của mỗi người,
Báo cáo ngày, và Trang chủ cho Leader. Quen rồi mới mở rộng.

---

# SỬA APP SAU NÀY

Muốn đổi gì — thêm người, đổi màu, sửa chữ:

1. Vào GitHub, mở repo `kitachi-marketing-os`
2. Bấm vào file cần sửa
3. Bấm biểu tượng **bút chì** ở góc phải trên
4. Sửa, kéo xuống bấm **Commit changes**
5. Đợi 30 giây, Vercel tự cập nhật web

---

# LỖI HAY GẶP

| Hiện tượng | Nguyên nhân | Cách sửa |
|---|---|---|
| Mở link ra trang trắng | Upload nhầm cả thư mục cha | Vào GitHub xoá hết, upload lại đúng cách D2.2 |
| Vẫn hiện "Chế độ xem thử" | `config.js` chưa điền hoặc dán thiếu | Xem lại C2, nhớ giữ dấu ngoặc kép |
| Chạy seed.sql báo duplicate key | Đã chạy rồi | Bỏ qua, kiểm tra số dòng ở B5 |
| Chạy SQL báo lỗi khác | File chưa copy hết | Ctrl+A trong Notepad rồi copy lại |
| Sửa xong web không đổi | Bộ nhớ đệm trình duyệt | Đợi 60 giây, nhấn Ctrl+Shift+R |
| Không thấy repo trong Vercel | Chưa cấp quyền | Bấm Adjust GitHub App Permissions |
| Đăng nhập báo sai PIN | PIN đã đổi ở E1 | Hỏi Leader PIN mới |
| Mất hết dữ liệu | Chạy lại `schema.sql` | File đó xoá bảng cũ — chỉ chạy một lần lúc cài |

---

# VỀ BẢO MẬT

Repo GitHub để **Private**. Nhưng khoá `anon` vẫn tải về trình duyệt của người dùng,
nên ai có link web đều truy cập được dữ liệu.

Với công cụ nội bộ 5 người thì rủi ro thấp. Chỉ cần:
- **Đừng đăng link ra ngoài** hoặc lên mạng xã hội
- **Đừng để dữ liệu nhạy cảm** như lương, hợp đồng, thông tin cá nhân khách hàng
- Mã PIN là lớp chặn nhẹ, không phải mật khẩu ngân hàng

Supabase gói miễn phí tạm ngưng project nếu 7 ngày không ai dùng.
Vào lại là chạy tiếp, không mất dữ liệu.

Sao lưu định kỳ: Supabase → Table Editor → chọn bảng → nút **Export** → **CSV**.
