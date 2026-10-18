# SHCD · Ôn tập & kiểm tra K22–K25

Website tra cứu đáp án 213 câu hỏi ôn tập và kiểm tra SHCD. Toàn bộ nội dung là tệp tĩnh, không cần backend.

## Nội dung

- `index.html` — khung ứng dụng
- `styles.css` — giao diện
- `app.js` — tìm kiếm, lọc, điều hướng và mở câu hỏi
- `data.js` — dữ liệu đã chuẩn hoá
- `assets/` — năm bản PDF đáp án và favicon

Năm bộ đề, chia theo trang NLU E-Learning:

| Nhóm | Bộ đề | Số câu | Cohort |
|---|---|---|---|
| Ôn tập | Quy chế đào tạo theo tín chỉ | 48 | Tất cả |
| Ôn tập | Nghị quyết 71-NQ/TW | 40 | Tất cả |
| Ôn tập | Tư tưởng Hồ Chí Minh | 30 | K25 |
| Bài kiểm tra | Đề kiểm tra | 40 | K22–K24 |
| Bài kiểm tra | Đề kiểm tra K25 | 55 | K25 |

Tổng: **213 câu**.

## Triển khai

Website dùng GitHub Pages với custom domain `shcd.yangio.id.vn` (tệp `CNAME` ở thư mục gốc).

Tại nhà đăng ký domain, thêm bản ghi:

| Host | Type | Value |
|---|---|---|
| `shcd` | CNAME | `thangvt-food.github.io.` |

Sau khi DNS lan truyền, bật **Enforce HTTPS** trong Settings → Pages.

## Ghi chú

`data.js` và các tệp trong `assets/` là bản build tĩnh từ ngân hàng câu hỏi trong workspace gốc. Đã điều chỉnh đáp án Câu 27 (Quy chế đào tạo), bổ sung Tư tưởng Hồ Chí Minh và đề kiểm tra K22–K24 / K25.
