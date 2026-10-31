# TL Sales Performance

Ứng dụng quản trị mục tiêu kinh doanh – Phòng Kinh doanh Tiến Lợi Group.
Chạy trên Cloudflare Pages, dữ liệu nằm trong Lark Base, mở trong Lark dưới dạng Web App.

## Cấu trúc
```
public/            Giao diện (chạy trên trình duyệt)
  index.html       Khung trang
  app.css          Giao diện, màu sắc
  config.js        CẤU HÌNH – sửa ngưỡng KPI, link Base, danh sách sản phẩm
  app.js           Lõi: tải dữ liệu, bộ lọc, tính mục tiêu/thực hiện/dự báo
  modules.js       8 phân hệ
  charts.js        Biểu đồ
  demo-data.json   Dữ liệu demo đã ẩn danh (xóa sau khi chạy thật)
functions/api/[[path]].js   Backend: đăng nhập Lark, phân quyền, đọc/ghi Lark Base
```

## Cloudflare Pages
- Framework preset: None · Build command: (trống) · Output directory: `public`
- Biến môi trường: `LARK_APP_ID`, `LARK_APP_SECRET` (Secret), `LARK_BASE_TOKEN`, `SESSION_SECRET` (Secret, ≥ 32 ký tự)
- Tùy chọn: `LARK_DOMAIN`, `LARK_ACCOUNTS_DOMAIN` (chỉ khi dùng Feishu)

## Lark Custom App
- Web app homepage: `https://<tên>.pages.dev/`
- Redirect URL: `https://<tên>.pages.dev/api/auth/callback`
- Quyền: `bitable:app`, `contact:user.email:readonly`
- Thêm app vào Base: Base → … → Add document app → Can edit

## Kiểm tra
`https://<tên>.pages.dev/api/health`

## API (backend)
| Đường dẫn | Chức năng |
|---|---|
| GET /api/me | Trạng thái đăng nhập |
| GET /api/auth/login, /callback, /logout | Đăng nhập Lark (OAuth) |
| GET /api/data?table=X&page=… | Đọc 500 dòng/lần, đã lọc theo quyền |
| POST/PUT /api/record | Tạo/sửa bản ghi (MUC_TIEU, KE_HOACH, VAN_DE, YEU_CAU_HANG) |
| GET /api/health | Kiểm tra cấu hình |
