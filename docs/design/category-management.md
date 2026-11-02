# Màn hình Quản lý danh mục

Tài liệu mô tả từng thành phần trên màn hình Quản lý danh mục của admin (`/admin/categories`)

## Mục lục

- [Bố cục chung](#bố-cục-chung)

1. [Tab Thông tin chung](#1-tab-thông-tin-chung)
2. [Tab Thuộc tính](#2-tab-thuộc-tính)
3. [Tab Quan hệ](#3-tab-quan-hệ)
4. [Tab Cấu hình thuật toán](#4-tab-cấu-hình-thuật-toán)
5. [Tab Câu hỏi xác minh](#5-tab-câu-hỏi-xác-minh)
6. [Trường nào admin nhập, trường nào hệ thống có sẵn](#6-trường-nào-admin-nhập-trường-nào-hệ-thống-có-sẵn)

## Bố cục chung

Màn hình chia hai cột: danh sách danh mục bên trái, chi tiết danh mục đang chọn bên phải. Trên điện thoại hai cột xếp chồng.

### Thanh trên cùng

| Thành phần            | Ý nghĩa                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------- |
| Cập nhật lần gần nhất | Thời điểm lưu thay đổi gần nhất trên màn hình. Chưa lưu lần nào thì hiện "Chưa có cập nhật". |
| Nút **Thêm danh mục** | Mở [hộp thoại Thêm danh mục](#hộp-thoại-thêm-danh-mục).                                      |

### Danh sách danh mục

| Thành phần                    | Ý nghĩa                                                                                                                                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Số danh mục                   | Tổng số danh mục đang có.                                                                                                                                                                                              |
| Ô **Tìm danh mục hoặc alias** | Lọc danh sách theo tên hoặc alias, không phân biệt hoa thường. Ví dụ gõ "pet" vẫn ra Thú cưng. Nút ✕ trong ô (hoặc phím Esc) xóa từ khóa. Không có kết quả thì hiện "Không tìm thấy danh mục" kèm nút **Xóa từ khóa**. |
| Mỗi dòng                      | Ảnh đại diện và tên danh mục. Bấm để mở chi tiết. Dòng đang mở được tô xanh nhạt.                                                                                                                                      |
| Thứ tự                        | Sắp theo **Thứ tự hiển thị** ([mục 1](#1-tab-thông-tin-chung)), trùng thứ tự thì theo tên.                                                                                                                             |

### Phần đầu chi tiết

| Thành phần           | Ý nghĩa                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------- |
| Ảnh đại diện         | Ảnh của danh mục. Chưa có ảnh hoặc ảnh lỗi thì hiện ô ảnh trống.                        |
| Tên danh mục         |                                                                                         |
| Alias: …             | Các cách gọi khác của danh mục. Không có alias thì ẩn dòng này.                         |
| Nút **Xóa danh mục** | Mở [hộp thoại xác nhận xóa](#hộp-thoại-xóa-danh-mục). Bị khóa khi chỉ còn một danh mục. |

### Thanh 5 tab

Năm tab xếp từ trái sang phải: Thông tin chung, Thuộc tính, Quan hệ, Cấu hình thuật toán, Câu hỏi xác minh. Mỗi tab một sắc xanh, đậm dần sang nhạt theo thứ tự, để admin nhận ra mình đang ở nhóm cấu hình nào. Tab đang mở được tô kín màu của nó.

Dùng phím mũi tên trái, phải để chuyển tab bằng bàn phím.

**Bản nháp.** Những gì đã gõ mà chưa lưu vẫn giữ khi chuyển qua lại giữa các tab, nhưng **mất khi chuyển sang danh mục khác**.

### Thanh lưu

Tab Thông tin chung, Quan hệ, Cấu hình thuật toán và khối "Bên trong có" của tab Thuộc tính có thanh lưu ở cuối:

| Thành phần             | Ý nghĩa                                                           |
| ---------------------- | ----------------------------------------------------------------- |
| "Có thay đổi chưa lưu" | Hiện khi bản nháp khác dữ liệu đã lưu.                            |
| Nút **Hủy**            | Bỏ bản nháp, trả về dữ liệu đã lưu.                               |
| Nút **Lưu thay đổi**   | Kiểm tra dữ liệu rồi lưu. Lỗi thì hiện thông báo đỏ và không lưu. |

Hai nút bị khóa khi không có thay đổi. Thuộc tính và câu hỏi xác minh lưu ngay trong hộp thoại riêng nên không cần thanh lưu.

### Hộp thoại Thêm danh mục

| Thành phần                  | Ý nghĩa                                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Tên danh mục                | Bắt buộc, không trùng tên danh mục khác (không phân biệt hoa thường).                                                              |
| Ảnh đại diện                | Như ở tab Thông tin chung ([mục 1](#1-tab-thông-tin-chung)). Có thể bỏ trống.                                                      |
| Cấu hình thuật toán ban đầu | Chọn nơi lấy 4 tham số của tab Cấu hình thuật toán: bán kính ban đầu, kiểu suy giảm k, trung vị thời gian chờ, hệ số khuếch tán D. |
| Dòng gợi ý dưới ô cấu hình  | Nói rõ sẽ lấy thông số từ đâu, đổi theo lựa chọn.                                                                                  |

Hai lựa chọn của ô **Cấu hình thuật toán ban đầu**:

| Lựa chọn                                      | Danh mục mới nhận                      | Khi nào dùng                                                               |
| --------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------- |
| Mặc định: đồ vật nằm yên, suy giảm trung tính | 400 m, k = 1, trung vị 3,5 ngày, D = 0 | Đồ vật thông thường                                                        |
| Chép từ _tên danh mục_                        | Đúng 4 tham số của danh mục được chọn  | Danh mục mới giống một danh mục có sẵn, ví dụ "Chim cảnh" chép từ Thú cưng |

Danh mục mới chưa có thuộc tính, quan hệ, câu hỏi và độ hiếm u. Thứ tự hiển thị được đặt cuối danh sách. Mọi giá trị đều sửa lại được sau khi tạo.

### Hộp thoại Xóa danh mục

Xóa danh mục thì xóa luôn thuộc tính, câu hỏi xác minh và cấu hình thuật toán của nó. Nếu danh mục khác đang khai báo danh mục này trong tab Quan hệ, hộp thoại liệt kê tên các danh mục đó, và danh mục bị xóa cũng được gỡ khỏi quan hệ của chúng. Nhóm quan hệ nào bị gỡ hết thành viên thì bị bỏ.

## 1. Tab Thông tin chung

Thông tin hiển thị cho người dùng, không ảnh hưởng đến điểm ghép cặp.

| Thành phần      | Trường dữ liệu   | Ràng buộc                            | Ý nghĩa                                                                                                                |
| --------------- | ---------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Tên danh mục    | `Category.name`  | Bắt buộc, không trùng                | Tên người dùng thấy khi đăng bài và lọc bảng tin.                                                                      |
| Thứ tự hiển thị | `Category.order` | Số nguyên 1 đến 999                  | Số nhỏ đứng trước, áp dụng cho danh sách bên trái và các chỗ người dùng chọn danh mục.                                 |
| Ảnh đại diện    | `Category.icon`  | JPG, PNG hoặc WEBP, tối đa 5 MB      | Ảnh nhận diện danh mục. Bấm vào ảnh, bấm **Tải ảnh lên / Đổi ảnh**, hoặc kéo thả ảnh vào. **Xóa ảnh** bỏ ảnh hiện tại. |
| Alias (nút +)   | `Alias`          | Ô trống và alias trùng bị bỏ khi lưu | Cách gọi khác của danh mục, ví dụ Thú cưng có "chó", "mèo", "pet". Tìm theo alias vẫn ra danh mục.                     |

Hiện ảnh chỉ được xem trước trên máy, tải lại trang thì mất ảnh vừa chọn. `Category.icon` sẽ lưu URL ảnh sau khi có API tải ảnh.

## 2. Tab Thuộc tính

Thuộc tính là các đặc điểm người đăng bài chọn, ví dụ Loài, Giống, Màu lông của Thú cưng. Thuật toán so từng thuộc tính của bài mất với bài nhặt ([matching-algorithm.md mục 5.4](matching-algorithm.md#54-thuộc-tính)).

### 2.1. Bảng thuộc tính

| Cột                 | Ý nghĩa                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Thuộc tính          | Tên thuộc tính.                                                                                                             |
| Giá trị · độ hiếm u | Bốn giá trị phổ biến nhất kèm độ hiếm u, ví dụ "Nâu 30% · Vàng 25% · …". "+3" là còn 3 giá trị nữa. "—" là chưa có số liệu. |
| Vai trò ghép cặp    | Nhãn **Tính điểm** (xanh) hoặc **Loại trừ** (đỏ).                                                                           |
| Độ tin cậy (m)      | Mức và giá trị, ví dụ "Vừa (0,90)".                                                                                         |
| Bắt buộc            | Có hoặc Không.                                                                                                              |
| Nút Xem / Sửa / Xóa | Xem chi tiết, sửa, xóa thuộc tính. Xóa phải xác nhận qua hộp thoại "Bạn có chắc muốn xóa thuộc tính …?".                    |

Câu dưới bảng: "Độ hiếm u là tỉ lệ bài trong danh mục có giá trị đó. Trùng giá trị càng hiếm càng được cộng nhiều."

### 2.2. Hộp thoại Thêm / Sửa thuộc tính

**Tên thuộc tính.** Bắt buộc, không trùng tên thuộc tính khác trong cùng danh mục.

**Vai trò ghép cặp.** Quyết định điều gì xảy ra khi hai bài **khác** giá trị:

| Lựa chọn                 | Khi hai bài khác giá trị                              | Dùng cho                                                              |
| ------------------------ | ----------------------------------------------------- | --------------------------------------------------------------------- |
| **Tính điểm** (mặc định) | Cặp bị trừ điểm b nhưng vẫn được chấm tiếp            | Thuộc tính người dùng dễ ghi lệch: màu, giống, chất liệu              |
| **Loại trừ**             | Cặp bị loại ngay ở bước lọc, không bao giờ được gợi ý | Thuộc tính gần như không ai ghi sai: Loài của Thú cưng, Loại thiết bị |

Khi hai bài **trùng** giá trị, cả hai vai trò đều được cộng điểm a. Khi một bên bỏ trống, thuộc tính bị bỏ qua: không cộng, không trừ.

Chọn Loại trừ thì hiện khung cảnh báo vàng: "Hai bài khác giá trị ở thuộc tính này sẽ không bao giờ được ghép. Chỉ dùng cho thuộc tính người dùng gần như không ghi sai." Đặt nhầm Loại trừ sẽ làm mất những cặp đúng chỉ vì một bên ghi lệch.

**Độ tin cậy khai báo (m).** Xác suất để hai bài **của cùng một món** ghi trùng giá trị ở thuộc tính này:

| Mức  | m    | Dùng khi                                             |
| ---- | ---- | ---------------------------------------------------- |
| Cao  | 0,95 | Rất khó ghi lệch, ví dụ Loài                         |
| Vừa  | 0,9  | Thỉnh thoảng ghi lệch, ví dụ Giống, Màu              |
| Thấp | 0,8  | Hay ghi lệch, ví dụ Chất liệu ví ("da" hay "giả da") |

m quyết định cả điểm cộng lẫn điểm trừ ([matching-algorithm.md mục 6.2](matching-algorithm.md#62-trọng-số-đồng-ý-và-không-đồng-ý)):

$$
a = \log_2\frac{m}{u} \ \text{(trùng)}, \qquad b = \log_2\frac{1-m}{1-u} \ \text{(khác)}
$$

Ví dụ Màu lông Nâu, u = 30%: m = 0,9 cho a ≈ +1,6 bit và b ≈ −2,8 bit; hạ xuống m = 0,8 thì a ≈ +1,4 bit và b ≈ −1,8 bit. Admin muốn một thuộc tính ảnh hưởng ít hơn thì hạ m, không sửa u. Mỗi +1 bit làm tỉ lệ cược "là cùng một món" tăng gấp đôi.

**Bắt buộc khi đăng bài.** Bật thì người đăng phải chọn giá trị cho thuộc tính này mới đăng được. Nên bật cho thuộc tính Loại trừ, vì thuộc tính bị bỏ trống không lọc được gì.

**Alias của thuộc tính (nút +).** Cách gọi khác của tên thuộc tính, ví dụ "Màu lông" còn gọi là "Màu".

**Giá trị (nút +).** Các lựa chọn người đăng được chọn. Cần ít nhất một giá trị, các giá trị không trùng nhau. Mỗi ô giá trị gồm:

| Thành phần         | Ý nghĩa                                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Giá trị _n_        | Tên giá trị, ví dụ Poodle.                                                                                                                         |
| u = _x_% (chỉ đọc) | Độ hiếm của giá trị, do hệ thống tính ([mục 2.4](#24-độ-hiếm-u-cách-tính)). Giá trị mới thêm hiện "u = —".                                         |
| Alias (nút +)      | Cách gọi khác được tính là cùng giá trị, ví dụ "chó cỏ" = Chó ta, "chó xù" = Poodle. Hai bài ghi khác chữ nhưng cùng nghĩa vẫn được tính là trùng. |
| Nút ✕              | Xóa giá trị.                                                                                                                                       |

**Hủy / Lưu thuộc tính.** Lưu thì kiểm tra rồi thêm hoặc cập nhật dòng trong bảng, có hiệu lực ngay.

### 2.3. Hộp thoại xem chi tiết thuộc tính

Ba ô tóm tắt (Vai trò ghép cặp, Độ tin cậy, Bắt buộc khi đăng) và bảng mọi giá trị với alias và độ hiếm u, xếp theo u giảm dần.

### 2.4. Độ hiếm u: cách tính

Con số "u = 30%" cạnh mỗi giá trị là độ hiếm u. u của danh mục ở thẻ Xem trước của tab Cấu hình thuật toán cũng tính theo cách này. Cả hai đều **do job định kỳ tính từ bài đăng, admin không nhập tay**. Cho admin tự gõ u thì điểm ghép cặp không còn phản ánh dữ liệu thật; admin muốn chỉnh mức ảnh hưởng thì chỉnh m.

[matching-algorithm.md](matching-algorithm.md#61-hai-xác-suất-m-và-u) định nghĩa u của giá trị là "tỉ lệ bài có giá trị đó trong cùng danh mục". Màn hình này dùng cách tính cụ thể dưới đây.

#### Mẫu số chỉ gồm bài có điền thuộc tính

$$
u(v) = \frac{\text{số bài trong danh mục chọn giá trị } v}{\text{số bài trong danh mục có điền thuộc tính đó}}
$$

Bài ghi bằng alias được đếm vào giá trị gốc.

Ví dụ Thú cưng có 500 bài, 300 bài điền Màu lông, 90 bài chọn Nâu:

| Cách chia                  | u(Nâu)         | Điểm cộng khi trùng (m = 0,9) |
| -------------------------- | -------------- | ----------------------------- |
| **Chỉ bài có điền** (dùng) | 90 / 300 = 30% | ≈ +1,6 bit                    |
| Mọi bài trong danh mục     | 90 / 500 = 18% | ≈ +2,3 bit                    |

Thuật toán chỉ so thuộc tính khi **cả hai bài đều điền**; bài bỏ trống không tham gia phép so sánh nên cũng không vào mẫu số. Chia cho mọi bài sẽ làm u nhỏ đi giả tạo, và thuộc tính càng ít người điền lại càng được cộng nhiều, ngược với thực tế. Với cách đã chọn, tổng u các giá trị của một thuộc tính bằng 100%.

#### Làm trơn và mức sàn

Khi giá trị chưa ai chọn thì u = 0 và a = log₂(m / 0) là vô hạn: một lần trùng đã đủ thành gợi ý mạnh. Khi mới có một bài chọn, u = 1/300 cho a ≈ +8,1 bit, gần chạm ngưỡng gợi ý mạnh (≈ 10,8 bit) chỉ nhờ một thuộc tính, trong khi con số dựa trên đúng một bài. Danh mục mới ít bài cũng vậy: thêm hay bớt một bài là u nhảy hàng chục phần trăm.

Job xử lý hai bước:

**Bước 1, làm trơn Laplace.** Cộng 1 vào tử và số giá trị K vào mẫu, giống cách tài liệu thuật toán ước lượng m ([matching-algorithm.md mục 9](matching-algorithm.md#9-ước-lượng-và-tự-cải-thiện-tham-số)):

$$
u(v) = \frac{n_v + 1}{N + K}
$$

với $n_v$ là số bài chọn v, N là số bài có điền thuộc tính, K là số giá trị của thuộc tính.

| Ví dụ                                           | Chưa làm trơn | Đã làm trơn    |
| ----------------------------------------------- | ------------- | -------------- |
| Danh mục mới 5 bài, Giống (K = 9), Poodle 1 bài | 20%           | 2/14 ≈ 14%     |
| Như trên, Corgi 0 bài                           | 0% (vô hạn)   | 1/14 ≈ 7%      |
| Màu lông (K = 6), Nâu 90/300 bài                | 30%           | 91/306 ≈ 29,7% |

Ít dữ liệu thì u được kéo về gần mức đều nhau 1/K; nhiều dữ liệu thì phần cộng thêm không đáng kể.

**Bước 2, mức sàn.** Chặn dưới u ở **1%**. Một thuộc tính cộng tối đa log₂(0,95 / 0,01) ≈ +6,6 bit, nên không thuộc tính nào tự đẩy được cặp lên ngưỡng gợi ý mạnh mà cần thêm thời gian, vị trí hoặc danh mục khớp. Mức sàn nên là một khóa trong Cấu hình hệ thống, nhóm Nâng cao.

**Trên màn hình.** Giá trị vừa thêm hiện "u = —" cho tới lần chạy job kế tiếp; trong lúc đó thuật toán dùng 1 / (N + K). u của danh mục cũng làm trơn và chặn sàn theo cách trên, với K là số danh mục.

### 2.5. Khối "Bên trong có"

Chỉ dùng cho **danh mục vật chứa** như Ví, Túi. Người đăng tích những món có bên trong, và thuật toán chấm điểm đồ bên trong theo phần giao nhau so với danh sách ngắn hơn ([matching-algorithm.md mục 5.4](matching-algorithm.md#54-thuộc-tính)).

| Thành phần                     | Ý nghĩa                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------- |
| Công tắc **Danh mục vật chứa** | Tắt thì danh mục không có checklist. Bật mà chưa có mục nào thì không lưu được. |
| Các mục (nút +)                | Danh sách món người đăng được tích, ví dụ Tiền mặt, CCCD/CMND, Thẻ ngân hàng.   |

Khối này có [thanh lưu](#thanh-lưu) riêng.

**Khác thuộc tính thế nào.** Thuộc tính mô tả chính món đồ (ví màu gì), còn "Bên trong có" mô tả những món nằm trong vật chứa (trong ví có gì). Cả hai đều góp vào tổng điểm ghép cặp, nhưng cách chấm khác nhau:

|                  | Thuộc tính                        | Bên trong có                                                  |
| ---------------- | --------------------------------- | ------------------------------------------------------------- |
| Người đăng chọn  | Một giá trị cho mỗi thuộc tính    | Nhiều mục cùng lúc                                            |
| Cách so          | Trùng hoặc khác                   | Phần giao nhau so với danh sách ngắn hơn, điểm S từ 0 đến 1   |
| Điểm             | Trùng cộng a, khác trừ b          | $w = S \cdot a + (1 - S) \cdot b$                             |
| Vai trò Loại trừ | Có                                | Không                                                         |
| m                | Riêng từng thuộc tính, admin chọn | Một số chung, đặt ở Cấu hình hệ thống (minh họa 0,8)          |
| u                | Riêng từng giá trị, ví dụ Nâu 30% | Một số chung: tỉ lệ khớp ở các cặp ngẫu nhiên đã qua bước lọc |
| Một bên bỏ trống | Bỏ qua                            | Bỏ qua                                                        |

Ví dụ người mất tích Tiền mặt, CCCD, Thẻ ATM; người nhặt tích CCCD, Thẻ ATM: S = 2 / 2 = 1, khớp hoàn toàn. Người nhặt liệt kê ít hơn nhưng không bị phạt.

Lý do không có thông số riêng cho từng mục:

1. **"Không tích" không có nghĩa là "không có".** Người nhặt có thể chỉ mở ra xem sơ, không muốn khai, hoặc tiền đã bị lấy trước đó. "Khác" không xác định được cho từng mục, nên không áp được cách trùng hoặc khác của thuộc tính.
2. **Các mục đi theo cụm.** CCCD, thẻ ATM và bằng lái thường có cùng nhau. Chấm từng mục riêng thì một bằng chứng ("ví của người đi làm") bị đếm nhiều lần, trái với giả định độc lập của Fellegi-Sunter. Gộp cả tập thành một tiêu chí thì chỉ góp một số hạng.
3. **Không đủ dữ liệu.** Muốn có u cho từng mục trong từng danh mục thì cần rất nhiều bài có khai đồ bên trong; ước lượng trên tập nhỏ sẽ dao động mạnh.
4. **Tham số dùng chung đặt một lần.** Mức khai đúng đồ bên trong là hành vi chung của người dùng, không phụ thuộc là ví hay túi.

**Giới hạn.** Trùng "CCCD" và trùng "Thẻ bảo hiểm" được tính như nhau. Hướng mở rộng là đánh trọng số từng mục theo độ hiếm, tương tự IDF trong TF-IDF, khi đã có đủ dữ liệu vận hành.

## 3. Tab Quan hệ

Khai báo những danh mục khác vẫn có thể là cùng một món đồ. Ví dụ người mất ghi "mất ví", còn người nhặt chỉ thấy và ghi "nhặt được CCCD".

| Thành phần            | Ý nghĩa                                                                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dòng giải thích       | "Bài mất thuộc danh mục này sẽ được ghép với bài nhặt thuộc các danh mục bên dưới. Trùng danh mục liên quan được tính bằng r lần trùng hẳn. Ví dụ Ví với Giấy tờ: 60%." |
| Nút **Thêm nhóm**     | Thêm một nhóm quan hệ mới với tỷ lệ mặc định 60%.                                                                                                                       |
| Nhóm _n_              | Một tập danh mục liên quan dùng chung một tỷ lệ r.                                                                                                                      |
| Ô **Tỷ lệ r** (%)     | Từ 1% đến 100%. Mỗi nhóm có r riêng, **không cần cộng đủ 100%**.                                                                                                        |
| Thẻ danh mục và nút ✕ | Danh mục đang thuộc nhóm; ✕ để bỏ ra.                                                                                                                                   |
| **Chọn danh mục**     | Mở danh sách để tích thêm danh mục. Danh mục đã nằm ở nhóm khác bị làm mờ kèm chữ "Nhóm khác", vì một danh mục chỉ được ở một nhóm.                                     |
| Nút ✕ của nhóm        | Xóa cả nhóm.                                                                                                                                                            |

Lưu bằng thanh lưu; nhóm không có danh mục nào thì không lưu được.

**Chiều quan hệ.** Quan hệ là **một chiều**, tra theo danh mục của bài mất. Khai báo Ví → Giấy tờ nghĩa là bài mất Ví được ghép với bài nhặt Giấy tờ. Muốn chiều ngược lại thì khai báo ở danh mục Giấy tờ.

**Ý nghĩa của r.** Cùng danh mục cho điểm danh mục s = 1; danh mục liên quan cho s = r. Điểm danh mục được nội suy giữa điểm cộng a và điểm trừ b của danh mục ([matching-algorithm.md mục 6.3](matching-algorithm.md#63-tiêu-chí-có-điểm-liên-tục)):

$$
w = r \cdot a + (1 - r) \cdot b
$$

r càng gần 100% thì trùng danh mục liên quan càng gần bằng trùng hẳn; r nhỏ thì cặp vẫn được xét nhưng gần như không được cộng điểm danh mục, có khi bị trừ. Danh mục không nằm trong quan hệ nào bị loại ngay ở bước lọc.

## 4. Tab Cấu hình thuật toán

Bốn tham số riêng của danh mục, quyết định cửa sổ thời gian và vùng tìm kiếm khi ghép cặp. Admin nhập đại lượng đời thường (ngày, mét), hệ thống tự đổi sang ký hiệu toán học.

### 4.1. Thẻ Thời gian

| Thành phần             | Trường                    | Ràng buộc        | Ý nghĩa                                                                                     |
| ---------------------- | ------------------------- | ---------------- | ------------------------------------------------------------------------------------------- |
| Kiểu suy giảm (k)      |                           |                  | Bốn nút chọn hình dạng đường suy giảm điểm thời gian. Chọn một kiểu thì hệ thống tự điền k. |
| Trung vị thời gian chờ | `Category.timeMedianDays` | 0,1 đến 365 ngày | Một nửa số trường hợp được nhặt và đăng bài trong vòng bao nhiêu ngày kể từ lúc mất.        |
| Hệ số hình dạng k      | `Category.timeShape`      | 0,3 đến 5        | Chỉ sửa được khi chọn Tùy chỉnh; các kiểu khác ghi "tự điền theo kiểu".                     |

| Kiểu suy giảm   | k       | Hình dạng                                 | Ví dụ danh mục          |
| --------------- | ------- | ----------------------------------------- | ----------------------- |
| Đồ vật rơi      | 1,5     | Giữ điểm cao vài ngày đầu rồi rơi nhanh   | Ví, giấy tờ, điện thoại |
| Trung tính      | 1       | Giảm đều                                  | Trang sức, chìa khóa    |
| Thú cưng đi lạc | 0,7     | Giảm nhanh lúc đầu rồi chậm dần, đuôi dài | Thú cưng                |
| Tùy chỉnh       | tự nhập | Admin tự nhập k                           |                         |

Hệ thống lưu trung vị chứ không lưu λ, vì khi đổi k thì trung vị vẫn giữ nguyên ý nghĩa. λ được tính lại lúc chạy: $\lambda = \text{trung vị} / (\ln 2)^{1/k}$.

### 4.2. Thẻ Vị trí

| Thành phần         | Trường                 | Ràng buộc                  | Ý nghĩa                                                                                                                                                                                                                            |
| ------------------ | ---------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bán kính ban đầu   | `Category.matchRadius` | Số nguyên 100 đến 50 000 m | Khoảng cách xa nhất món đồ có thể được tìm thấy ngay lúc mất. Gợi ý dưới ô: "Sai số ghim cộng quãng chạy lúc mới lạc". Đồ vật khoảng 400 m; thú cưng lớn hơn hẳn, ví dụ 2 400 m, vì con vật chạy được một quãng trong vài giờ đầu. |
| Hệ số khuếch tán D | `Category.diffusion`   | 0 đến 5 000 000 m²/ngày    | Vùng tìm rộng ra theo thời gian nhanh đến đâu. Gợi ý dưới ô: "Đồ vật để 0: vùng tìm không đổi. Thú cưng: vùng tìm rộng dần".                                                                                                       |

Bán kính ban đầu bằng 3σ₀. Sau Δt ngày, độ lệch tăng theo $\sigma^2 = \sigma_0^2 + 2D\Delta t$ ([matching-algorithm.md mục 5.2](matching-algorithm.md#52-vị-trí-nhân-gauss-và-mô-hình-khuếch-tán)).

### 4.3. Thẻ Xem trước (chỉ đọc)

Tính lại ngay khi đổi số, kể cả trước khi lưu. Số nhập sai thì hiện "—".

| Con số                  | Công thức                                                                      | Ý nghĩa                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Cửa sổ thời gian Tₘₐₓ   | $\lambda \cdot (-\ln S_{\min})^{1/k}$, $S_{\min}$ = 0,05                       | Bài nhặt đăng sau bài mất quá số ngày này thì không ghép.                                           |
| Tần suất danh mục u     | Tỉ lệ bài thuộc danh mục trên toàn bộ bài ([mục 2.4](#24-độ-hiếm-u-cách-tính)) | Danh mục càng hiếm thì trùng danh mục càng được cộng nhiều. Chưa có thì hiện "Tự tính từ bài đăng". |
| Bán kính lọc lúc mất    | $3\sigma_0$ = bán kính ban đầu                                                 | Bài nhặt xa hơn mức này thì không ghép, xét ngay lúc mất.                                           |
| Sau 7 ngày, sau 30 ngày | $3\sqrt{\sigma_0^2 + 2D\Delta t}$                                              | Vùng lọc nếu bài nhặt đăng sau 7 hoặc 30 ngày. Với D = 0 thì không đổi.                             |

Ví dụ với hai danh mục mẫu:

| Danh mục  | Bán kính | k   | Trung vị | D       | Tₘₐₓ       | Lúc mất | Sau 7 ngày | Sau 30 ngày |
| --------- | -------- | --- | -------- | ------- | ---------- | ------- | ---------- | ----------- |
| Ví & tiền | 400 m    | 1,5 | 1,6 ngày | 0       | ≈ 4,2 ngày | 400 m   | 400 m      | 400 m       |
| Thú cưng  | 2 400 m  | 0,7 | 12 ngày  | 150 000 | ≈ 97 ngày  | 2,4 km  | 5 km       | 9,3 km      |

$S_{\min}$ và các tham số dùng chung khác thuộc Cấu hình hệ thống, không sửa ở đây.

## 5. Tab Câu hỏi xác minh

Danh sách **câu hỏi gợi ý** cho người nhặt khi đăng tin Nhặt được. Người nhặt chọn hoặc tự đặt một câu hỏi trắc nghiệm; người muốn nhận đồ phải trả lời đúng, chỉ được trả lời một lần.

| Thành phần           | Ý nghĩa                                                                    |
| -------------------- | -------------------------------------------------------------------------- |
| Nút **Thêm câu hỏi** | Mở hộp thoại nhập câu hỏi.                                                 |
| Mỗi dòng             | Số thứ tự và nội dung câu hỏi.                                             |
| Nút Sửa / Xóa        | Sửa, xóa câu hỏi. Xóa phải xác nhận qua hộp thoại có kèm nội dung câu hỏi. |

Hộp thoại Thêm / Sửa câu hỏi gồm tên danh mục, ô **Nội dung câu hỏi** (bắt buộc, tối đa 500 ký tự) và bộ đếm ký tự.

Câu hỏi nên hỏi điều chỉ chủ nhân biết và không có trong bài đăng công khai. Định danh riêng như số CCCD, IMEI, biển số không được dùng làm thuộc tính hay để chấm điểm, nên chúng chỉ xuất hiện ở đây ([matching-algorithm.md mục 5.4](matching-algorithm.md#54-thuộc-tính)).

## 6. Trường nào admin nhập, trường nào hệ thống có sẵn

Mỗi trường trên màn hình thuộc một trong bốn loại:

| Loại                | Nghĩa                                                                      |
| ------------------- | -------------------------------------------------------------------------- |
| **Admin nhập**      | Admin gõ tay chữ hoặc số                                                   |
| **Admin chọn**      | Admin chọn trong các lựa chọn có sẵn, bật tắt công tắc, hoặc chọn file ảnh |
| **Mặc định có sẵn** | Hệ thống điền sẵn một giá trị, admin đổi được                              |
| **Hệ thống tính**   | Chỉ đọc, hệ thống tính từ dữ liệu hoặc công thức, admin không sửa được     |

Cả màn hình chỉ có **6 ô admin gõ số**: thứ tự hiển thị, tỷ lệ r, trung vị thời gian chờ, hệ số k (khi chọn Tùy chỉnh), bán kính ban đầu và hệ số khuếch tán D. Độ tin cậy m được chọn trong ba mức có sẵn chứ không gõ số, để admin không đặt những con số tùy ý. Mọi phần trăm độ hiếm u đều do hệ thống tính.

### 6.1. Hộp thoại Thêm danh mục

| Trường                      | Loại            | Ý nghĩa                                                                                         |
| --------------------------- | --------------- | ----------------------------------------------------------------------------------------------- |
| Tên danh mục                | Admin nhập      | Chữ, bắt buộc                                                                                   |
| Ảnh đại diện                | Admin chọn      | Chọn file ảnh, có thể bỏ trống                                                                  |
| Cấu hình thuật toán ban đầu | Admin chọn      | Mặc định có sẵn: 400 m, k = 1, trung vị 3,5 ngày, D = 0. Hoặc chép 4 số của một danh mục có sẵn |
| Mã danh mục                 | Hệ thống tính   | Tự tạo khi lưu                                                                                  |
| Thứ tự hiển thị             | Mặc định có sẵn | Đặt cuối danh sách, sửa lại ở tab Thông tin chung                                               |
| Độ hiếm u của danh mục      | Hệ thống tính   | Chưa có cho tới lần chạy job kế tiếp                                                            |

### 6.2. Tab Thông tin chung

| Trường          | Loại       | Con số và ý nghĩa                                                                   |
| --------------- | ---------- | ----------------------------------------------------------------------------------- |
| Tên danh mục    | Admin nhập |                                                                                     |
| Thứ tự hiển thị | Admin nhập | Số nguyên 1 đến 999. Số 1 đứng đầu danh sách; hai danh mục cùng số thì xếp theo tên |
| Ảnh đại diện    | Admin chọn | JPG, PNG hoặc WEBP, tối đa 5 MB                                                     |
| Alias           | Admin nhập |                                                                                     |

### 6.3. Hộp thoại Thêm / Sửa thuộc tính

| Trường                   | Loại                           | Con số và ý nghĩa                                                                                        |
| ------------------------ | ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Tên thuộc tính           | Admin nhập                     |                                                                                                          |
| Vai trò ghép cặp         | Admin chọn, mặc định Tính điểm | Quyết định khác giá trị thì bị trừ điểm hay bị loại                                                      |
| Độ tin cậy (m)           | Admin chọn, mặc định Vừa       | Ba mức có sẵn: Cao 0,95, Vừa 0,9, Thấp 0,8. Là xác suất hai bài của cùng một món ghi trùng giá trị       |
| Bắt buộc khi đăng bài    | Admin chọn, mặc định tắt       |                                                                                                          |
| Alias của thuộc tính     | Admin nhập                     |                                                                                                          |
| Giá trị và alias giá trị | Admin nhập                     |                                                                                                          |
| u của từng giá trị       | Hệ thống tính                  | Tỉ lệ bài có điền thuộc tính chọn giá trị này ([mục 2.4](#24-độ-hiếm-u-cách-tính)). Giá trị mới hiện "—" |

Mức m đổi điểm thế nào, ví dụ giá trị Nâu có u = 30%:

| Mức m    | Trùng Nâu (a) | Khác giá trị (b) | Khi nào chọn                                       |
| -------- | ------------- | ---------------- | -------------------------------------------------- |
| Cao 0,95 | +1,7 bit      | −3,8 bit         | Gần như không ai ghi lệch; lệch là bằng chứng mạnh |
| Vừa 0,9  | +1,6 bit      | −2,8 bit         | Thỉnh thoảng ghi lệch                              |
| Thấp 0,8 | +1,4 bit      | −1,8 bit         | Hay ghi lệch; lệch chỉ bị trừ nhẹ                  |

m chủ yếu quyết định **mức trừ khi lệch**; mức cộng khi trùng phụ thuộc nhiều hơn vào u.

### 6.4. Khối "Bên trong có"

| Trường                     | Loại            | Ý nghĩa                                               |
| -------------------------- | --------------- | ----------------------------------------------------- |
| Công tắc Danh mục vật chứa | Admin chọn      | Bật thì người đăng thấy checklist                     |
| Các mục                    | Admin nhập      | Tên món người đăng được tích                          |
| m, u của đồ bên trong      | Hệ thống có sẵn | Dùng chung, đặt ở Cấu hình hệ thống, không hiện ở đây |

### 6.5. Tab Quan hệ

| Trường              | Loại                     | Con số và ý nghĩa                                                                                                                                                                                                     |
| ------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Danh mục trong nhóm | Admin chọn               | Chọn trong danh sách danh mục có sẵn                                                                                                                                                                                  |
| Tỷ lệ r             | Admin nhập, mặc định 60% | 1% đến 100%. Trùng danh mục liên quan được tính bằng r lần trùng hẳn. 100% coi như cùng danh mục; 60% (Ví với Giấy tờ) là liên quan khá chặt; r thấp thì cặp vẫn được xét nhưng gần như không được cộng điểm danh mục |

### 6.6. Tab Cấu hình thuật toán

| Trường                 | Loại                                    | Con số và ý nghĩa                                                                        | Đổi số thì sao                                                                                      |
| ---------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Kiểu suy giảm          | Admin chọn                              | Đồ vật rơi, Trung tính, Thú cưng đi lạc hoặc Tùy chỉnh                                   | Chọn kiểu nào thì hệ thống điền k của kiểu đó                                                       |
| Trung vị thời gian chờ | Admin nhập                              | 0,1 đến 365 ngày. Một nửa số trường hợp được nhặt và đăng bài trong vòng chừng ấy ngày   | Tₘₐₓ tăng tỉ lệ thuận: Ví 1,6 ngày cho Tₘₐₓ ≈ 4,2 ngày; tăng lên 3,2 ngày thì Tₘₐₓ ≈ 8,5 ngày       |
| Hệ số hình dạng k      | Hệ thống điền; admin nhập khi Tùy chỉnh | 0,3 đến 5. k > 1: giữ điểm cao rồi rơi nhanh. k < 1: rơi nhanh lúc đầu, đuôi dài         | Cùng trung vị 3,5 ngày: k = 1,5 cho Tₘₐₓ ≈ 9,3 ngày; k = 1 cho ≈ 15 ngày; k = 0,7 cho ≈ 28 ngày     |
| Bán kính ban đầu       | Admin nhập                              | 100 đến 50 000 m. Khoảng cách xa nhất món đồ có thể được tìm thấy ngay lúc mất, bằng 3σ₀ | Bằng đúng bán kính lọc lúc mất                                                                      |
| Hệ số khuếch tán D     | Admin nhập                              | 0 đến 5 000 000 m²/ngày. 0 là đồ vật nằm yên                                             | Bán kính 2 400 m, sau 7 ngày: D = 0 vẫn 2,4 km; D = 50 000 thành ≈ 3,5 km; D = 150 000 thành ≈ 5 km |
| Tₘₐₓ, u, bán kính lọc  | Hệ thống tính                           | Thẻ Xem trước ([mục 4.3](#43-thẻ-xem-trước-chỉ-đọc))                                     | Tính lại ngay khi đổi số                                                                            |
| $S_{\min}$             | Hệ thống có sẵn                         | 0,05, đặt ở Cấu hình hệ thống                                                            | Không sửa ở đây                                                                                     |

### 6.7. Hộp thoại Thêm / Sửa câu hỏi xác minh

| Trường           | Loại          | Ý nghĩa                          |
| ---------------- | ------------- | -------------------------------- |
| Danh mục         | Hệ thống tính | Tên danh mục đang mở, chỉ để xem |
| Nội dung câu hỏi | Admin nhập    | Bắt buộc, tối đa 500 ký tự       |
| Bộ đếm ký tự     | Hệ thống tính | Số ký tự đã gõ trên 500          |
