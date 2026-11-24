# Hướng cải thiện Learn in Motion

Ghi lại các đề xuất sau khi đã có: feed lướt từng thẻ, theo dõi nguồn, Discover, phụ đề podcast, giao diện sáng/tối.
Xếp theo mức độ quan trọng. Đánh dấu `[x]` khi làm xong.

**Nên làm trước:** (1) git và HTTPS, (2) lưu link bằng một chạm qua Shortcut, (3) ôn lại takeaway theo lịch.
Hai việc đầu khiến app dùng được thật hằng ngày trên iPhone, việc thứ ba làm app thật sự giúp nhớ lâu.

## 1. Nền tảng

- [x] **Git**: https://github.com/harrydevforlife/learn-in-motion
- [ ] **Đưa các bài test tự động vào repo** (ví dụ `tests/`). Hiện chúng chỉ nằm trong thư mục tạm trên máy.
- [x] **Đưa lên HTTPS**: https://harrydevforlife.github.io/learn-in-motion/ (GitHub Pages).
  Nhờ vậy chế độ offline và nút **Paste** chạy được (iOS chỉ cho phép trên HTTPS), dùng được ngoài mạng Wi-Fi nhà,
  và địa chỉ cố định nên cài ra màn hình chính không lo mất dữ liệu khi đổi máy chủ.
- [ ] **Lưu link bằng một chạm từ nút Share.** Hiện phải copy link rồi dán vào app.
  - [x] App nhận link qua địa chỉ `?add=<link>` và lưu ngay. Hướng dẫn tạo Shortcut "Save to Learn" nằm trong README.
  - [ ] Shortcut mở link bằng Safari chứ không mở app ngoài màn hình chính, mà hai bên giữ dữ liệu riêng.
    Muốn link vào thẳng app ngoài màn hình chính thì cần một "hộp thư" trung gian, ví dụ GitHub Gist:
    Shortcut ghi link vào Gist, app đọc và nhận link mỗi khi mở.
  - (iOS không hỗ trợ Web Share Target cho PWA, nên Shortcut là cách thay thế.)

## 2. Học tốt hơn

- [ ] **Ôn lại takeaway theo lịch.** Sau 1, 3, 7 ngày, takeaway cũ tự hiện lại thành thẻ "Bạn còn nhớ không?".
  Hiện bấm "Got it" xong là bài nằm yên trong tab Learned.
- [x] **Tốc độ phát podcast** (1×, 1.25×, 1.5×, 2×), trong thanh phát riêng của app, kèm nút lùi 15 giây và tới 30 giây.
- [x] **YouTube nhớ chỗ đang xem** và hỏi "Got it?" khi xem hết, giống podcast (YouTube IFrame API).
- [x] **Tự phát khi lướt tới thẻ** (Autoplay) và **bắt đầu từ highlight** ("Most replayed" của YouTube).
- [ ] **Highlight cho podcast.** Gần như không show nào đánh dấu soundbite trong feed, nên cần AI đọc transcript để chọn đoạn hay nhất (cần API key).
- [ ] **Kiểm tra autoplay trên iPhone thật**: video tắt tiếng khi iOS chặn tiếng, và podcast tự phát sau lần chạm đầu.
- [ ] **Đọc bài viết ngay trong app** (reader mode). r.jina.ai đã trả về nội dung chữ của trang, khỏi phải mở Safari.
- [ ] **Xuất takeaway ra Markdown** để đưa sang Notion hay Obsidian.

## 3. Discover thông minh hơn

- [ ] **Học từ thói quen.** Kênh hay được Save thì gợi ý nhiều hơn, loại hay bị Skip thì giảm đi.
  Hiện gợi ý chỉ dựa vào kết quả tìm kiếm.
- [ ] **Đỡ tốn dung lượng.** Mỗi lần làm mới tốn vài MB vì phải tải nguyên trang kết quả YouTube (khoảng 1,5 MB mỗi lượt tìm).

## 4. Độ bền

- [ ] **Proxy riêng.** App đang dựa vào dịch vụ miễn phí của bên thứ ba (r.jina.ai, rss2json.com, microlink.io), dễ bị giới hạn hoặc ngừng chạy.
  Một proxy nhỏ của riêng mình (Cloudflare Worker, gói miễn phí) sẽ ổn định hơn và không gửi dữ liệu cho bên thứ ba.
  Proxy này cũng mở được transcript của podcast trên Substack (ví dụ Lenny's Podcast): link transcript chuyển hướng mà không cho phép CORS, còn r.jina.ai từ chối vì file không ghi rõ là chữ.
- [ ] **Tách code.** `app.js` đã khoảng 1.900 dòng, nên tách thành vài module (feed, player, sources, discover, sheets).
- [ ] **Phụ đề AI** cho podcast không có transcript sẵn (Huberman Lab, Hidden Brain…), dùng Whisper, Deepgram hoặc AssemblyAI.
  Cần API key và có phí (ước tính khoảng 0,2–0,4 USD mỗi giờ audio, kiểm tra lại giá trước khi làm). Key sẽ nằm trên điện thoại vì không có backend.

## Ý tưởng khác

- [ ] Đồng bộ giữa các thiết bị (Supabase, GitHub Gist hoặc Google Drive) khi cần backend.
- [ ] Nhập playlist YouTube "Learn" qua YouTube Data API (playlist riêng tư cần đăng nhập Google).
- [ ] Mục tiêu mỗi ngày và chuỗi ngày học (streak).
