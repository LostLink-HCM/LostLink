const CATEGORY_DETAILS = {
  'Giấy tờ & thẻ': {
    radius: 1500,
    aliases: ['CCCD', 'thẻ sinh viên', 'giấy phép lái xe'],
    attributes: [
      [
        'Tên trên giấy tờ',
        'exclude',
        'strong',
        ['họ tên'],
        [
          { value: 'Họ tên', aliases: ['tên đầy đủ', 'họ và tên'] },
          { value: 'Tên viết tắt', aliases: ['tên rút gọn', 'tên ngắn'] },
        ],
      ],
      [
        'Loại giấy tờ',
        'score',
        'strong',
        ['CCCD', 'bằng lái'],
        [
          { value: 'CCCD', aliases: ['căn cước', 'căn cước công dân'] },
          { value: 'Bằng lái xe', aliases: ['GPLX', 'giấy phép lái xe', 'bằng lái'] },
          { value: 'Thẻ sinh viên', aliases: ['thẻ SV', 'student card'] },
        ],
      ],
      [
        'Mã số một phần',
        'score',
        'medium',
        ['4 số cuối'],
        [
          { value: '4 số cuối', aliases: ['bốn số cuối', '4 ký tự cuối'] },
          { value: '6 số cuối', aliases: ['sáu số cuối', '6 ký tự cuối'] },
        ],
      ],
    ],
    inside: ['Ví đựng giấy tờ', 'Bao nhựa trong', 'Túi nhỏ'],
    questions: [
      'Trên giấy tờ có tên hoặc ảnh nhận diện nào?',
      'Bạn còn nhớ 4 số cuối của mã giấy tờ không?',
    ],
  },
  'Ví & tiền': {
    radius: 800,
    aliases: ['bóp', 'ví da'],
    attributes: [
      ['Màu sắc', 'score', 'medium', ['màu ví']],
      ['Chất liệu', 'score', 'medium', ['da', 'vải']],
      ['Giấy tờ bên trong', 'exclude', 'strong', ['CCCD trong ví']],
    ],
    inside: ['Tiền mặt', 'Thẻ ngân hàng', 'Giấy tờ tùy thân'],
    questions: [
      'Bên trong ví có loại thẻ hoặc giấy tờ nào?',
      'Ví có đặc điểm nhận diện riêng nào không?',
    ],
  },
  'Túi & balo': {
    radius: 1800,
    aliases: ['ba lô', 'túi xách'],
    attributes: [
      ['Màu sắc', 'score', 'medium', ['màu túi']],
      ['Kích thước', 'score', 'weak', ['nhỏ', 'lớn']],
      ['Nhãn hiệu', 'score', 'strong', ['brand']],
    ],
    inside: ['Laptop', 'Sách vở', 'Đồ cá nhân'],
    questions: [
      'Bên trong túi có vật gì dễ nhận biết?',
      'Túi có logo, móc khóa hoặc hình dán nào không?',
    ],
  },
  'Thiết bị điện tử': {
    radius: 2500,
    aliases: ['điện thoại', 'laptop', 'máy tính bảng'],
    attributes: [
      ['Hãng sản xuất', 'score', 'strong', ['Apple', 'Samsung']],
      ['Màu thiết bị', 'score', 'medium', ['màu máy']],
      ['Mã thiết bị', 'exclude', 'strong', ['IMEI', 'serial']],
    ],
    inside: ['Ốp lưng', 'Tai nghe', 'Cáp sạc'],
    questions: [
      'Thiết bị có hình nền hoặc ốp lưng đặc biệt nào?',
      'Bạn nhớ một phần mã IMEI hoặc serial không?',
    ],
  },
  'Chìa khóa & xe cộ': {
    radius: 1200,
    aliases: ['chìa khóa xe', 'smartkey'],
    attributes: [
      ['Loại chìa khóa', 'score', 'strong', ['xe máy', 'ô tô']],
      ['Số lượng chìa', 'score', 'medium', ['một chìa', 'chùm chìa']],
      ['Biển số xe', 'exclude', 'strong', ['biển số']],
    ],
    inside: ['Móc khóa', 'Bao da', 'Thẻ từ'],
    questions: ['Chìa khóa có móc hoặc bao bọc đặc biệt nào?', 'Chìa khóa thuộc loại xe nào?'],
  },
  'Trang sức & phụ kiện': {
    radius: 1000,
    aliases: ['trang sức', 'phụ kiện'],
    attributes: [
      ['Chất liệu', 'score', 'strong', ['vàng', 'bạc']],
      ['Màu sắc', 'score', 'weak', ['màu phụ kiện']],
      ['Khắc chữ', 'exclude', 'strong', ['ký hiệu']],
    ],
    inside: ['Hộp đựng', 'Túi vải', 'Giấy bảo hành'],
    questions: [
      'Món đồ có ký hiệu hoặc chữ khắc nào không?',
      'Bạn còn giữ hộp hoặc giấy bảo hành không?',
    ],
  },
  'Thú cưng': {
    radius: 5000,
    aliases: ['chó', 'mèo', 'thú nuôi'],
    attributes: [
      ['Loài', 'exclude', 'strong', ['chó', 'mèo']],
      ['Màu lông', 'score', 'medium', ['màu lông']],
      ['Đặc điểm nhận diện', 'exclude', 'strong', ['vết đốm', 'vòng cổ']],
    ],
    inside: ['Vòng cổ', 'Thẻ tên', 'Dây dắt'],
    questions: [
      'Thú cưng có đặc điểm nhận diện hoặc vết thương nào?',
      'Lần cuối bạn thấy thú cưng ở khu vực nào?',
    ],
  },
  Khác: {
    radius: 2000,
    aliases: ['đồ khác'],
    attributes: [
      ['Loại đồ vật', 'score', 'medium', ['phân loại']],
      ['Màu sắc', 'score', 'weak', ['màu đồ vật']],
    ],
    inside: [],
    questions: ['Đồ vật có đặc điểm riêng nào giúp xác minh?'],
  },
}

export function createAdminCategories() {
  return Object.entries(CATEGORY_DETAILS).map(([name, detail], categoryIndex) => ({
    id: `CAT-${String(categoryIndex + 1).padStart(3, '0')}`,
    name,
    aliases: detail.aliases,
    radius: detail.radius,
    attributes: detail.attributes.map(([name, , strength, aliases, values], index) => ({
      id: `${categoryIndex + 1}-${index + 1}`,
      name,
      strength,
      aliases,
      values: (values || []).map((attributeValue, valueIndex) => ({
        id: `${categoryIndex + 1}-${index + 1}-value-${valueIndex + 1}`,
        value: attributeValue.value,
        aliases: attributeValue.aliases,
      })),
    })),
    inside: detail.inside.map((label, index) => ({
      id: `inside-${categoryIndex + 1}-${index}`,
      label,
      enabled: true,
    })),
    questions: detail.questions.map((text, index) => ({
      id: `question-${categoryIndex + 1}-${index}`,
      text,
    })),
    relations: [],
  }))
}
