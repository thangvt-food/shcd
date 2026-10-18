# SHCD · Ôn tập

Website tra cứu đáp án 128 câu hỏi ôn tập Quy chế đào tạo theo tín chỉ và Nghị quyết 71-NQ/TW. Toàn bộ nội dung là tệp tĩnh, không cần backend.

## Nội dung

- `index.html` — khung ứng dụng
- `styles.css` — giao diện
- `app.js` — tìm kiếm, lọc, điều hướng và mở câu hỏi
- `data.js` — dữ liệu đã chuẩn hoá
- `assets/` — ba bản PDF đáp án và favicon

Ba bộ đề: Quy chế đào tạo (48 câu), Nghị quyết 71 (40 câu), Đề kiểm tra tổng hợp (40 câu).

## Triển khai

Website dùng GitHub Pages với custom domain `shcd.yangio.id.vn` (tệp `CNAME` ở thư mục gốc).

Tại nhà đăng ký domain, thêm bản ghi:

| Host | Type | Value |
|---|---|---|
| `shcd` | CNAME | `thangvt-food.github.io.` |

Sau khi DNS lan truyền, bật **Enforce HTTPS** trong Settings → Pages.

## Ghi chú

`data.js` và các tệp trong `assets/` là bản build tĩnh từ ngân hàng câu hỏi trong workspace gốc. Bản PDF Quy chế đào tạo đã được điều chỉnh đáp án Câu 27.
