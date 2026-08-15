# Marketing OS · Kitachi

Hệ điều hành cho phòng marketing 5 người, nhiều kênh, nhiều dự án.

**Bắt đầu từ đâu:**
- [`SETUP.md`](SETUP.md) — cài đặt để cả phòng dùng chung (45 phút)
- [`VAN-HANH.md`](VAN-HANH.md) — nếp làm việc hằng ngày cho từng vai

**Xem thử ngay:** giải nén rồi mở `index.html` bằng Chrome.
PIN: Công Tuân `1111` · Trang Linh `2222` · Hồng Hạnh `3333` · Phạm Vỹ `4444` · Diệu Thảo `5555`

---

## Đang có sẵn

5 nhân sự · 12 kênh · 3 dự án · 235 đầu việc · 14 bài đăng · 9 chiến dịch quảng cáo ·
24 khoản ngân sách · 22 quyền × 5 vai

## 30 màn hình

**Hằng ngày** — Trang chủ · Báo cáo ngày · Phê duyệt · Lịch trực nhật

**Phòng ban** — Content Marketing · Editor Video · Designer

**Nội dung & kênh** — Lịch đăng · Kênh & chỉ số

**Dự án** — Dự án · Đầu việc · Tiến độ & đợt việc · Rủi ro

**Ngân sách & quảng cáo** — Quảng cáo · Ngân sách

**Đội ngũ** — Hiệu suất · Thành viên · Cơ cấu tổ chức · Vai trò & quyền ·
Ghi nhận đồng đội · Cuộc họp

**Hệ thống** — Tài liệu · Nhật ký · Lưu trữ · Cài đặt

## Cấu trúc thư mục

```
mkt-os/
├── index.html      giao diện
├── style.css       màu sắc, bố cục (font Be Vietnam Pro, nền sáng)
├── app.js          toàn bộ logic
├── config.js       ← điền khoá Supabase vào đây
├── demo-data.js    dữ liệu mẫu cho chế độ xem thử
├── vercel.json
├── SETUP.md        hướng dẫn cài đặt
├── VAN-HANH.md     nếp làm việc hằng ngày
└── supabase/
    ├── schema.sql  chạy trước — tạo 18 bảng
    └── seed.sql    chạy sau — nạp dữ liệu
```
