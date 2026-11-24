# Hướng cải thiện Learn in Motion

Ghi lại các đề xuất sau khi đã có: feed lướt từng thẻ, theo dõi nguồn, Discover, phụ đề podcast, giao diện sáng/tối.
Xếp theo mức độ quan trọng. Đánh dấu `[x]` khi làm xong.

**Nên làm trước:** (1) git và HTTPS, (2) lưu link bằng một chạm qua Shortcut, (3) ôn lại takeaway theo lịch.
Hai việc đầu khiến app dùng được thật hằng ngày trên iPhone, việc thứ ba làm app thật sự giúp nhớ lâu.

## 1. Nền tảng

- [ ] **Git.** Thư mục dự án chưa là git repo, nên code và lịch sử thay đổi đều có thể mất.
  Cần `git init`, commit, và đưa các bài test tự động (hiện chỉ nằm trong thư mục tạm) vào repo, ví dụ `tests/`.
- [ ] **Đưa lên HTTPS** (GitHub Pages hoặc Cloudflare Pages, miễn phí). Đang chạy `http://192.168.1.10:5173` nên:
  - chế độ offline (service worker) và nút **Paste** không chạy, vì iOS chỉ cho phép chúng trên HTTPS;
  - chỉ dùng được khi điện thoại ở cùng Wi-Fi với máy Mac đang bật;
  - nếu cài ra màn hình chính bây giờ, đổi địa chỉ sau này sẽ mất dữ liệu (mỗi địa chỉ có kho lưu riêng).
- [ ] **Lưu link bằng một chạm từ nút Share.** Hiện phải copy link rồi dán vào app.
  - Làm một iOS Shortcut "Save to Learn" để chọn ngay trong nút Share của YouTube, Safari hay Podcasts.
  - App cần nhận link qua địa chỉ dạng `?add=<link>` và mở sẵn bảng lưu. Hiện chưa có.
  - (iOS không hỗ trợ Web Share Target cho PWA, nên Shortcut là cách thay thế.)

## 2. Học tốt hơn

- [ ] **Ôn lại takeaway theo lịch.** Sau 1, 3, 7 ngày, takeaway cũ tự hiện lại thành thẻ "Bạn còn nhớ không?".
  Hiện bấm "Got it" xong là bài nằm yên trong tab Learned.
- [ ] **Tốc độ phát podcast** (1.25×, 1.5×, 2×). Trình phát audio của iOS khi phát trong trang không có nút chỉnh tốc độ.
- [ ] **YouTube nhớ chỗ đang xem** và hỏi "Got it?" khi xem hết, giống podcast. Dùng YouTube IFrame API (`enablejsapi=1`).
- [ ] **Đọc bài viết ngay trong app** (reader mode). r.jina.ai đã trả về nội dung chữ của trang, khỏi phải mở Safari.
- [ ] **Xuất takeaway ra Markdown** để đưa sang Notion hay Obsidian.

## 3. Discover thông minh hơn

- [ ] **Học từ thói quen.** Kênh hay được Save thì gợi ý nhiều hơn, loại hay bị Skip thì giảm đi.
  Hiện gợi ý chỉ dựa vào kết quả tìm kiếm.
- [ ] **Đỡ tốn dung lượng.** Mỗi lần làm mới tốn vài MB vì phải tải nguyên trang kết quả YouTube (khoảng 1,5 MB mỗi lượt tìm).

## 4. Độ bền

- [ ] **Proxy riêng.** App đang dựa vào dịch vụ miễn phí của bên thứ ba (r.jina.ai, rss2json.com, microlink.io), dễ bị giới hạn hoặc ngừng chạy.
  Một proxy nhỏ của riêng mình (Cloudflare Worker, gói miễn phí) sẽ ổn định hơn và không gửi dữ liệu cho bên thứ ba.
- [ ] **Tách code.** `app.js` đã khoảng 1.900 dòng, nên tách thành vài module (feed, player, sources, discover, sheets).
- [ ] **Phụ đề AI** cho podcast không có transcript sẵn (Huberman Lab, Hidden Brain…), dùng Whisper, Deepgram hoặc AssemblyAI.
  Cần API key và có phí (ước tính khoảng 0,2–0,4 USD mỗi giờ audio, kiểm tra lại giá trước khi làm). Key sẽ nằm trên điện thoại vì không có backend.

## Ý tưởng khác

- [ ] Đồng bộ giữa các thiết bị (Supabase, GitHub Gist hoặc Google Drive) khi cần backend.
- [ ] Nhập playlist YouTube "Learn" qua YouTube Data API (playlist riêng tư cần đăng nhập Google).
- [ ] Mục tiêu mỗi ngày và chuỗi ngày học (streak).
