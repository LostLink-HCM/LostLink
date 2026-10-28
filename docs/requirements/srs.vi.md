# Đặc tả yêu cầu phần mềm (SRS) - LostLink

[English](srs.md) | **Tiếng Việt**

## 1. Giới thiệu

LostLink là nền tảng web giúp người dân TP.HCM tìm lại và trao trả đồ thất lạc: hệ thống tự động gợi ý ghép cặp tin Mất đồ với tin Nhặt được, xác minh quyền sở hữu trước khi trao trả và bảo vệ thông tin liên hệ của hai bên. Tài liệu này liệt kê các yêu cầu chức năng và phi chức năng, làm căn cứ chung cho thiết kế, hiện thực, kiểm thử và review code.

### 1.1. Vai trò

Vai trò cao hơn kế thừa quyền của vai trò thấp hơn. Riêng kiểm duyệt bài đăng (M03) và xử lý report (M04) chỉ dành cho Moderator.

| Vai trò       | Mô tả                                        | Nhóm yêu cầu      |
| ------------- | -------------------------------------------- | ----------------- |
| **Guest**     | Khách vãng lai, chưa đăng nhập               | G01-G05           |
| **User**      | Người dùng đã đăng nhập và xác thực email    | G01, G02, U01-U09 |
| **Moderator** | Người kiểm duyệt nội dung và xử lý giao dịch | U01-U09, M01-M07  |
| **Admin**     | Quản trị viên hệ thống                       | U01-U09, A01-A09  |

### 1.2. Thuật ngữ

| Thuật ngữ               | Ý nghĩa                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| Tin Mất đồ / Nhặt được  | Hai loại bài đăng. Bộ ghép cặp luôn đối chiếu một tin Mất đồ với một tin Nhặt được.         |
| Gợi ý ghép cặp          | Cặp bài đối ứng được hệ thống chấm điểm và gửi cho cả hai bên, kèm mức giống nhau và lý do. |
| Câu hỏi xác minh        | Câu hỏi trắc nghiệm do người nhặt đặt cho tin Nhặt được, chỉ được trả lời một lần.          |
| Yêu cầu liên hệ         | Một tin nhắn giới thiệu gửi tới người đăng bài, cần được đồng ý thì mới mở hội thoại.       |
| Chuyển cấp (Escalation) | Hồ sơ giao dịch bị treo được chuyển cho Moderator xử lý.                                    |
| Cảnh báo khu vực        | Vùng (tâm và bán kính) người dùng theo dõi để nhận thông báo khi có bài mới.                |
| Điểm uy tín             | Điểm cộng khi trao trả thành công và theo đánh giá, dùng cho bảng vinh danh và huy hiệu.    |

## 2. Yêu cầu chức năng

### 2.1. Guest

#### G01 - Xem và tìm kiếm bài đăng

- **Xem danh sách tin mới:** chỉ hiển thị bài đã được Moderator duyệt và không bị ẩn. Mỗi card gồm ảnh bìa, nhãn Mất đồ/Nhặt được, tên người đăng, danh mục, tiêu đề, thời gian đăng, mô tả ngắn, địa điểm và khu vực, thời điểm mất/nhặt, số lượt thích, bình luận và lượt xem. Mặc định sắp xếp mới nhất trước. Bấm vào card để xem chi tiết.
- **Lọc và tìm kiếm:** lọc theo loại tin, danh mục, khu vực, khoảng thời gian (mặc định: tất cả danh mục, 7 ngày qua). Tìm theo từ khóa trên tên đồ vật, mô tả, khu vực, địa điểm.
- **Xem tin hot:** sắp xếp theo `hotScore = lượt xem + lượt thích × 20`, dùng chung bộ lọc với trang chủ.
- **Xem chi tiết bài đăng:** hình ảnh, loại tin, danh mục, tiêu đề, mô tả, thuộc tính, thời gian đăng, thời điểm mất/nhặt, địa điểm, người đăng kèm điểm uy tín và số lần trao trả, số lượt thích/bình luận/lượt xem, danh sách bình luận. Mỗi lần mở bài tính một lượt xem.
- Khi Guest bấm Thích, Lưu bài, Theo dõi, Bình luận, "Đây là đồ của tôi", "Tôi đang giữ món này" hoặc Báo cáo, hệ thống chuyển sang màn hình Đăng nhập và đưa người dùng quay lại trang đang xem sau khi đăng nhập.

#### G02 - Xem bảng vinh danh và thống kê cộng đồng

- **Bảng vinh danh:** bảng "Người tốt bụng" theo quý, xếp theo điểm uy tín, gồm hạng, tên người dùng, số lần trao trả, điểm. Guest chỉ xem ở cột phải trang chủ, bấm vào một người thì hệ thống yêu cầu đăng nhập.
- **Thống kê cộng đồng:** số liệu tổng, không có tên: số tin đã đăng, số đồ đã trao trả, tỷ lệ ghép cặp thành công, thời gian trao trả trung bình.

#### G03 - Đăng ký tài khoản

- **Tên người dùng:** 3-30 ký tự, chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới, không trùng người khác.
- **Email:** đúng định dạng, tự chuyển chữ thường. Nếu email đã được xác thực trước đó thì báo email đã được đăng ký.
- **Mật khẩu:** 8-72 ký tự ASCII, không dấu, không khoảng trắng, có ít nhất 1 chữ thường, 1 chữ hoa, 1 chữ số, 1 ký tự đặc biệt.
- **Nhận email:** không bắt buộc, mặc định được chọn. **Đồng ý điều khoản:** bắt buộc.
- Thông tin hợp lệ thì tạo tài khoản ở trạng thái chưa xác thực và gửi mã 6 số qua email.
- **Xác thực email:** mã OTP 6 chữ số, hiệu lực 10 phút, sai tối đa 5 lần (quá số lần phải yêu cầu mã mới). Gửi lại mã thì mã cũ bị hủy. Xác thực thành công thì tự động đăng nhập.

#### G04 - Đăng nhập

- **Email và mật khẩu:** sai thông tin thì chỉ báo chung "Email hoặc mật khẩu không đúng". Tài khoản chưa xác thực email được chuyển sang màn hình xác thực (nhập mã đã nhận hoặc Gửi lại mã). Tài khoản bị khóa không được đăng nhập.
- **Google:** xác thực bằng Google ID token. Tài khoản đã liên kết Google thì đăng nhập ngay. Chưa có tài khoản thì tạo mới: tên người dùng sinh từ phần trước @ của email (tự thêm số nếu trùng), email coi như đã xác thực.

#### G05 - Khôi phục mật khẩu

- **Quên mật khẩu:** nhập email, hệ thống gửi liên kết đặt lại mật khẩu có hiệu lực 10 phút.
- **Đặt lại mật khẩu:** liên kết phải đúng và còn hạn, mật khẩu mới theo quy tắc của G03. Đặt lại thành công thì đăng xuất khỏi mọi thiết bị.

### 2.2. User

User được dùng các chức năng G01, G02 của Guest.

#### U01 - Đăng xuất

Hủy phiên hiện tại, token cũ bị thu hồi và không dùng lại được.

#### U02 - Quản lý hồ sơ cá nhân

- **Xem hồ sơ:** tên người dùng, ảnh đại diện, giới thiệu, huy hiệu, điểm uy tín, bài đã đăng, lời cảm ơn/đánh giá từ người khác.
- **Cập nhật hồ sơ:** sửa ảnh đại diện, giới thiệu, khu vực hay để ý.

#### U03 - Quản lý tài khoản

- **Đổi mật khẩu:** nhập mật khẩu hiện tại và mật khẩu mới, đổi xong thì các phiên cũ bị thu hồi.
- **Đổi email:** email mới phải chưa được dùng và phải xác thực bằng OTP trước khi thay thế email cũ.
- **Xóa tài khoản:** phải xác nhận lại. Mọi bài đăng và tin nhắn bị xóa, không khôi phục được sau 3 ngày kể từ khi xác nhận.

#### U04 - Kết nối cộng đồng

- **Xem hồ sơ người khác:** tên, huy hiệu, giới thiệu, điểm uy tín, bài đăng (lọc Tất cả / Mất đồ / Nhặt được), mục "Người khác nói gì".
- **Theo dõi / bỏ theo dõi:** nhận thông báo khi đối phương đăng bài mới.
- **Chặn / bỏ chặn:** ẩn tin của người bị chặn và khóa hội thoại với họ. Bỏ chặn thì hiển thị lại tin và mở khóa hội thoại.

#### U05 - Quản lý bài đăng cá nhân

- **Đăng bài mất đồ / nhặt được:**
  - Phân loại: loại tin, danh mục, thuộc tính.
  - Nội dung: tiêu đề bắt buộc (tối đa 120 ký tự), mô tả tối đa 1.000 ký tự, ảnh tùy chọn (JPG, PNG hoặc WEBP, tối đa 9 ảnh, mỗi ảnh không quá 5 MB, ảnh đầu tiên làm ảnh bìa).
  - Thời gian: ngày mất/nhặt bắt buộc, không ở tương lai. Có thể chọn mốc gần đúng ("Sáng nay", "Tối hôm qua") và khoảng thời gian trong ngày.
  - Vị trí: GPS, kéo ghim, gõ địa chỉ hoặc chọn đoạn đường, kèm khu vực quận/huyện bắt buộc.
  - Câu hỏi xác minh trắc nghiệm: chỉ cho tin Nhặt được, có thể bỏ qua.
  - Xem lại trước khi đăng: hiển thị toàn bộ nội dung theo từng bước, có thể quay lại sửa từng bước.
  - Bài mới ở trạng thái Chờ xét duyệt. Tài khoản đang bị hạn chế không được đăng.
- **Lưu nháp:** lưu nội dung đang nhập dở. Mở lại form Đăng bài thì hiển thị bản nháp để đăng tiếp từ bước đang làm dở.
- **Sửa bài:** chỉ sửa bài của mình, không sửa được bài Đã liên hệ, Đã trao trả hoặc Đã đóng. Sửa xong thì bài về Chờ xét duyệt và tạm ẩn cho tới khi được duyệt lại.
- **Xóa bài:** chỉ xóa bài của mình. Bài đang có ghép cặp hoặc hội thoại hoạt động thì cảnh báo trước khi xóa.
- **Đóng bài / Đã trao trả:** đóng bài khi không tìm thấy hoặc không cần nữa (Đã đóng), hoặc tự đánh dấu Đã trao trả. Mỗi lần đổi trạng thái được ghi vào lịch sử.

#### U06 - Tương tác bài đăng

- **Bình luận:** tối đa 500 ký tự, chỉ sửa/xóa bình luận của mình, mỗi lần gửi cách nhau ít nhất 15 giây.
- **Thích / bỏ thích:** mỗi người thích một bài một lần, lượt thích dùng để tính tin hot.
- **Lưu bài:** lưu vào mục Đã lưu để xem lại.
- **Theo dõi bài:** nhận thông báo khi bài đổi trạng thái hoặc có bình luận mới.
- **Báo cáo vi phạm:**
  - Báo cáo bài đăng (từ Chi tiết bài đăng) với lý do: đòi tiền, spam, tin giả, khác. Báo cáo người dùng (từ hội thoại) với lý do: đòi tiền, spam, quấy rối, nhận vơ, khác.
  - Chọn "Khác" thì bắt buộc nhập mô tả. Mô tả tối đa 1.000 ký tự, ảnh chụp màn hình tùy chọn (tối đa 3 ảnh JPG, PNG hoặc WEBP, mỗi ảnh không quá 5 MB).
  - Mỗi người chỉ báo cáo một bài hoặc một người dùng một lần. Người báo cáo được ẩn danh, nhận kết quả xử lý và bị giới hạn tần suất gửi.

#### U07 - Ghép cặp và xác minh

- **Gợi ý ghép cặp:** danh sách "Có thể đây là đồ của bạn?", mỗi gợi ý gồm card bài đối ứng, điểm khớp và lý do ("cách ~800 m", "lệch 1 ngày"). Người mất bấm "Đúng là đồ của tôi" để sang bước xác minh hoặc gửi yêu cầu liên hệ. Người nhặt bấm "Tôi đang giữ món này" để gửi yêu cầu liên hệ. Chọn "Không phải" thì gợi ý chuyển sang bị từ chối.
- **Nhận đồ trực tiếp từ bài đăng:** bài Nhặt được có nút "Đây là đồ của tôi", bài Mất đồ có nút "Tôi đang giữ món này". Bấm xong thì vào luồng xác minh/liên hệ, có giới hạn tần suất.
- **Trả lời câu hỏi xác minh:** áp dụng khi bài Nhặt được có câu hỏi, chỉ trả lời một lần. Đúng thì mở hội thoại và bài chuyển Đã liên hệ. Sai thì xác minh thất bại và không thử lại được với bài đó.

#### U08 - Liên hệ và trao trả

- **Gửi yêu cầu liên hệ:** áp dụng khi bài Nhặt được không có câu hỏi xác minh, hoặc khi người nhặt bấm "Tôi đang giữ món này" trên bài Mất đồ. Người gửi chỉ được một tin nhắn giới thiệu và chỉ nhắn tiếp sau khi được đồng ý.
- **Duyệt yêu cầu liên hệ:** người đăng bài xem tin giới thiệu rồi Đồng ý (mở hội thoại, bài chuyển Đã liên hệ) hoặc Từ chối.
- **Nhắn tin:** chỉ mở sau khi xác minh đúng hoặc yêu cầu liên hệ được đồng ý. Danh sách hội thoại có tìm kiếm, mỗi hội thoại gắn với bài liên quan, gửi được văn bản và ảnh. User có thể chủ động mở hội thoại với Moderator để được hỗ trợ (khiếu nại, giao dịch bị treo, sự cố…).
- **Xác nhận đã trao trả:** cả hai bên cùng xác nhận thì bài chuyển Đã trao trả và người trả đồ được cộng điểm uy tín. Quá 30 ngày chưa xác nhận thì hệ thống gửi yêu cầu để Moderator xác nhận hộ.
- **Đóng và mở lại hội thoại:**
  - Một bên được đóng hội thoại khi phát hiện món đồ không khớp. Nếu bài không còn hội thoại nào khác đang mở thì bài về Đang tìm, ngược lại chỉ đóng hội thoại đó.
  - Hội thoại do mình đóng chuyển sang mục "Đã đóng": tin nhắn mới của bên kia vẫn được lưu nhưng không gửi thông báo và không tính vào số tin chưa đọc.
  - Bên còn lại thấy ghi chú món đồ không khớp, vẫn nhắn được nhưng không xác nhận trao trả được.
  - Người đóng có thể mở lại bất cứ lúc nào. Nếu bài còn Đang tìm thì bài chuyển lại Đã liên hệ.
- **Đánh giá và gửi lời cảm ơn:** hiện khi bài Đã trao trả. Chọn mức đánh giá 5 bậc, điểm tốt của người kia và viết lời cảm ơn. Đánh giá ảnh hưởng tới điểm uy tín.

#### U09 - Nhận thông báo

- **Thiết lập thông báo:** bật/tắt email, bật/tắt thông báo đẩy, chọn loại thông báo muốn nhận. Tắt email thì không nhận email nhắc sau 12 tiếng.
- **Trung tâm thông báo:** thông báo về ghép cặp, bình luận, bài được duyệt/từ chối, kết quả báo cáo, tin mới trong khu vực theo dõi. Lọc theo loại, đánh dấu đã đọc. Thông báo quan trọng gửi kèm email nếu đã bật.
- **Cảnh báo khu vực:** chọn tâm trên bản đồ và bán kính, thêm/xóa/bật-tắt từng vùng. Có tin mới trong vùng thì nhận thông báo.

### 2.3. Moderator

Các danh sách dạng bảng dưới đây đều phân trang 10 dòng mỗi trang.

#### M01 - Xem trang tổng quan (Dashboard)

Số bài theo từng trạng thái (Chờ xét duyệt, Đã từ chối, Đang tìm, Đã liên hệ, Đã trao trả, Đã đóng), số bài đang chờ duyệt, số bài/tài khoản bị báo cáo, số hồ sơ đang chờ chuyển cấp.

#### M02 - Quản lý tất cả bài đăng

- **Danh sách:** ID, thông tin bài (tên, danh mục), phân loại, thời gian và vị trí, thống kê (lượt xem, bình luận, số bài ghép cặp), trạng thái.
- **Chi tiết:** ID, tên bài, người đăng, loại bài, danh mục, ngày giờ đăng, vị trí, trạng thái, mô tả, hình ảnh, danh sách bài ghép cặp sắp theo tỷ lệ khớp giảm dần.
- Cập nhật trạng thái bài. Ẩn bài, bắt buộc nhập lý do.
- Tìm kiếm. Lọc theo trạng thái, danh mục, loại bài, khu vực, khoảng thời gian. Tải xuống danh sách.

#### M03 - Kiểm duyệt bài đăng

- **Danh sách chờ duyệt:** ID, tên bài, loại bài, người đăng (kèm điểm uy tín), danh mục và vị trí.
- **Chi tiết:** tên bài, ID, người đăng, điểm uy tín, loại tin, danh mục, thời gian đăng, vị trí, mô tả, hình ảnh.
- Duyệt bài (có hộp thoại xác nhận). Từ chối bài, bắt buộc nhập lý do.
- Tìm kiếm. Lọc theo danh mục, loại bài, khu vực, khoảng thời gian. Tải xuống danh sách.

#### M04 - Quản lý hàng đợi report

- **Danh sách:** thời gian (ID, ngày giờ bị báo cáo), loại báo cáo (tài khoản/bài đăng), đối tượng, lý do và mức độ (nghiêm trọng/cảnh báo).
- **Chi tiết:** ID, thời gian, đối tượng, loại, lý do, mức độ, nội dung của người báo cáo.
- Xử lý: gửi cảnh cáo, khóa tài khoản hoặc ẩn bài tùy lý do và mức độ, bỏ qua báo cáo nếu không đúng.
- Tìm kiếm. Lọc theo loại báo cáo, mức độ, khoảng thời gian. Tải xuống danh sách.

#### M05 - Chuyển cấp xử lý (Escalation)

- **Danh sách:** cặp ghép, thông tin hai bên, thời gian chờ, trạng thái.
- **Chi tiết hồ sơ:** thông tin bên nhặt và bên mất, nhóm hồ sơ, thời gian hoạt động gần nhất, lịch sử email nhắc nhở.
- Gửi email nhắc hai bên (tiêu đề và nội dung có gợi ý sẵn, kèm lý do).
- Xác nhận hộ đã trao trả, xác nhận hộ không chính xác, gắn nhãn đã xác minh, ẩn bài nghi vấn. Mọi thao tác đều bắt buộc nhập lý do/căn cứ.
- Tìm theo mã, đồ vật, tên người đăng. Lọc theo nhóm hồ sơ, đã/chưa xử lý. Xem nhật ký thao tác.

#### M06 - Nhắn tin

Nhắn tin với User/Admin, tìm theo tên, lọc theo User/Admin, đánh dấu chưa đọc, gắn cờ ưu tiên.

#### M07 - Quản lý thông báo

Xem danh sách, tìm theo nội dung, lọc theo loại/khoảng thời gian/chưa đọc/đã ghim, đánh dấu đã đọc, ghim thông báo quan trọng (hiển thị lên đầu), xóa thông báo.

### 2.4. Admin

Các danh sách dạng bảng dưới đây đều phân trang 10 dòng mỗi trang.

#### A01 - Xem trang tổng quan (Dashboard)

- Số bài đăng, tỷ lệ ghép cặp thành công, số báo cáo phát sinh, số lượt khóa tài khoản.
- Biểu đồ so sánh tin mất và tin nhặt theo khoảng thời gian.
- 5 khu vực có nhiều bài nhất (giảm dần). Chọn một khu vực để xem các chỉ số và biểu đồ của khu vực đó.
- Lọc theo khoảng thời gian, khu vực.

#### A02 - Quản lý người dùng

- **Danh sách:** tài khoản, vai trò, trạng thái, ngày tham gia.
- **Chi tiết:** mã tài khoản, tên người dùng, email, ngày tham gia, cập nhật gần nhất, huy hiệu.
- Khóa tài khoản (bắt buộc nhập lý do, có thông báo cho người dùng). Cấp/thu hồi quyền Moderator (bắt buộc nhập lý do).
- Tìm kiếm. Lọc theo vai trò (User/Moderator/Admin), trạng thái (hoạt động/hạn chế/đã khóa). Sắp xếp theo tham gia gần nhất, uy tín cao nhất, uy tín thấp nhất, tên A-Z. Tải xuống danh sách.

#### A03 - Quản lý danh mục

- Xem, tìm, thêm, sửa, xóa danh mục. Danh mục gồm tên, alias, bán kính ghép cặp, nhóm quan hệ, thuộc tính, câu hỏi xác minh gợi ý.
- Thêm, sửa, xóa thuộc tính: tên, độ mạnh (mạnh/vừa/yếu), alias.
- Thêm, sửa câu hỏi xác minh gợi ý.
- Tên danh mục và alias không được trùng.

#### A04 - Quản lý tất cả bài đăng

Như M02.

#### A05 - Quản lý cấu hình hệ thống

- Xem cấu hình hiện tại, kèm thời gian cập nhật gần nhất.
- **Ngưỡng thời gian:** ngưỡng không hoạt động (số ngày), thời gian nhắc liên hệ sau khi hai bên xác nhận ghép cặp, thời hạn hoàn tất giao dịch.
- **Trọng số ghép nối:** vị trí, thời gian, danh mục, mô tả, hình ảnh. Mỗi trọng số là số nguyên 0-100%, tổng phải bằng 100%.
- **Kết quả ghép cặp:** số kết quả đề xuất tối đa.
- **Ngưỡng xử lý báo cáo:** số ngày.
- Lưu hoặc hủy thay đổi.

#### A06 - Chuyển cấp xử lý (Escalation)

Như M05.

#### A07 - Xem nhật ký thao tác

Danh sách gồm thời gian, người thực hiện, hành động, đối tượng, chi tiết. Tìm kiếm, lọc theo vai trò/đối tượng/khoảng thời gian, tải xuống danh sách.

#### A08 - Nhắn tin

Nhắn tin với Moderator, tìm theo tên Moderator hoặc nội dung, đánh dấu chưa đọc, gắn cờ ưu tiên.

#### A09 - Quản lý thông báo

Như M07.

## 3. Yêu cầu phi chức năng

| Mã   | Yêu cầu                    | Mô tả                                                                                                                                                                                                                                                                              |
| ---- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NF01 | Ẩn thông tin liên hệ       | Email/liên hệ không hiển thị công khai. Tin nhắn giới thiệu không chứa số điện thoại, địa chỉ. Người bị báo cáo không biết ai báo cáo.                                                                                                                                             |
| NF02 | Lưu mật khẩu và mã         | Mật khẩu băm bằng bcrypt. OTP, token đặt lại mật khẩu, đáp án câu hỏi xác minh chỉ lưu dạng băm.                                                                                                                                                                                   |
| NF03 | Quản lý phiên              | JWT: access token 15 phút, refresh token 7 ngày, tự làm mới. Đăng xuất, đổi hoặc đặt lại mật khẩu thì mọi token cũ bị thu hồi.                                                                                                                                                     |
| NF04 | Phân quyền                 | Kiểm tra quyền ở server theo vai trò và quyền sở hữu. Guest chỉ đọc dữ liệu công khai.                                                                                                                                                                                             |
| NF05 | Chống lạm dụng, gian lận   | API xác thực 20 yêu cầu/15 phút/IP, API chung 300 yêu cầu/15 phút. OTP sai tối đa 5 lần. Câu hỏi xác minh trả lời 1 lần.                                                                                                                                                           |
| NF07 | Sao lưu và phục hồi        | CSDL sao lưu tự động hằng ngày lúc 04:00, giữ 6 tháng gần nhất. Admin có thể phục hồi khi xảy ra sự cố.                                                                                                                                                                            |
| NF08 | Xử lý lỗi                  | Lỗi trả về cùng một định dạng. Lỗi 5xx không lộ chi tiết nội bộ. Lỗi dịch vụ ngoài (gửi email) không làm hỏng thao tác chính.                                                                                                                                                      |
| NF09 | Toàn vẹn và sẵn sàng       | Mọi thay đổi trạng thái bài đều ghi lịch sử. Hệ thống hoạt động tối thiểu 99% thời gian mỗi tháng.                                                                                                                                                                                 |
| NF10 | Thời gian phản hồi         | Tải trang, lọc, tìm kiếm không quá 2 giây. Thao tác lưu không quá 3 giây (không tính tải ảnh). Gợi ý ghép cặp có trong vòng 1 phút sau khi bài được duyệt, nếu tồn tại bài thỏa điều kiện.                                                                                         |
| NF11 | Khả năng chịu tải          | Phục vụ tối thiểu 100 người dùng đồng thời vẫn đạt NF10. Danh sách có phân trang, dùng chỉ mục địa lý.                                                                                                                                                                             |
| NF12 | Dễ dùng                    | Giao diện tiếng Việt, báo lỗi rõ ràng. Ưu tiên desktop, hỗ trợ responsive trên mobile.                                                                                                                                                                                             |
| NF13 | Tích hợp dịch vụ bên ngoài | Google Identity, Cloudinary (tối đa 9 ảnh mỗi bài, mỗi ảnh không quá 5 MB), dịch vụ gửi email, dịch vụ bản đồ và geocoding.                                                                                                                                                        |
| NF14 | Cấu hình tham số           | Bán kính, cửa sổ thời gian, trọng số thuật toán, ngưỡng báo cáo, các mốc nhắc chỉnh được qua màn hình Admin, không sửa code.                                                                                                                                                       |
| NF15 | Nhật ký hệ thống           | Log lỗi server. Audit log hành động Moderator/Admin (ai, làm gì, khi nào), chỉ đọc. Log không chứa mật khẩu, OTP, token.                                                                                                                                                           |
| NF16 | Dữ liệu cá nhân, bản quyền | Tuân thủ Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 và Nghị định 356/2025/NĐ-CP: chỉ gửi email khi người dùng đồng ý, người dùng được xóa dữ liệu. Chỉ dùng thư viện mã nguồn mở có giấy phép cho phép dùng miễn phí. Tuân thủ điều khoản của Google, Cloudinary, dịch vụ bản đồ. |
