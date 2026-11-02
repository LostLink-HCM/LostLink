// Dữ liệu mẫu cho trang Quản lý danh mục.
// Tham số λ, k, D, matchRadius và độ hiếm u là số minh họa của docs/design/matching-algorithm.md.

const CATEGORY_IMAGES = {
  'Giấy tờ & thẻ': 'giay-to-the',
  'Ví & tiền': 'vi-tien',
  'Túi & balo': 'tui-balo',
  'Thiết bị điện tử': 'thiet-bi-dien-tu',
  'Chìa khóa & xe cộ': 'chia-khoa-xe-co',
  'Trang sức & phụ kiện': 'trang-suc-phu-kien',
  'Thú cưng': 'thu-cung',
  Khác: 'khac',
}

const COLOR_ALIASES = {
  Xám: ['ghi'],
  Bạc: ['bạch kim'],
  'Xanh dương': ['xanh nước biển', 'xanh da trời'],
  'Nhiều màu': ['sặc sỡ', 'họa tiết'],
}

const colorValues = (frequencies) =>
  Object.entries(frequencies).map(([value, u]) => [value, u, COLOR_ALIASES[value]])

const ITEM_COLORS = {
  Đen: 0.3,
  Trắng: 0.12,
  Xám: 0.08,
  Bạc: 0.06,
  Nâu: 0.1,
  Đỏ: 0.06,
  Hồng: 0.05,
  Vàng: 0.05,
  'Xanh lá': 0.03,
  'Xanh dương': 0.1,
  'Nhiều màu': 0.05,
}

// Thuộc tính viết gọn: [tên, vai trò, m, bắt buộc, [[giá trị, u, alias?], ...]].
// Định danh riêng (số CCCD, IMEI, biển số) không là thuộc tính, chỉ nằm trong câu hỏi xác minh.
const CATEGORY_DETAILS = {
  'Giấy tờ & thẻ': {
    aliases: ['giấy tờ', 'CCCD', 'thẻ sinh viên', 'giấy phép lái xe'],
    matchRadius: 400,
    timeShape: 1.5,
    timeMedianDays: 1.6,
    diffusion: 0,
    frequency: 0.37,
    attributes: [
      [
        'Loại giấy tờ',
        'score',
        0.95,
        true,
        [
          ['CCCD/CMND', 0.46, ['căn cước', 'chứng minh nhân dân']],
          ['Bằng lái xe', 0.14, ['GPLX', 'bằng lái']],
          ['Giấy tờ xe', 0.12, ['cà vẹt', 'đăng ký xe']],
          ['Thẻ sinh viên', 0.1, ['thẻ SV']],
          ['Thẻ ngân hàng', 0.1, ['thẻ ATM']],
          ['Hộ chiếu', 0.03, ['passport']],
          ['Khác', 0.05],
        ],
      ],
    ],
    questions: ['Họ tên in trên giấy tờ là gì?', 'Bạn còn nhớ 4 số cuối của mã số giấy tờ không?'],
  },
  'Ví & tiền': {
    aliases: ['bóp', 'ví da'],
    matchRadius: 400,
    timeShape: 1.5,
    timeMedianDays: 1.6,
    diffusion: 0,
    frequency: 0.18,
    attributes: [
      [
        'Chất liệu',
        'score',
        0.8,
        false,
        [
          ['Da', 0.55, ['giả da', 'simili']],
          ['Vải', 0.25, ['canvas']],
          ['Nhựa', 0.1],
          ['Khác', 0.1],
        ],
      ],
      ['Màu chủ đạo', 'score', 0.9, false, colorValues(ITEM_COLORS)],
    ],
    contents: [
      'Tiền mặt',
      'CCCD/CMND',
      'Bằng lái xe',
      'Thẻ ngân hàng',
      'Thẻ sinh viên',
      'Ảnh',
      'Danh thiếp',
    ],
    relations: [['Giấy tờ & thẻ', 0.6]],
    questions: [
      'Bên trong ví có loại thẻ hoặc giấy tờ nào?',
      'Ví có đặc điểm nhận diện riêng nào không?',
    ],
  },
  'Túi & balo': {
    aliases: ['ba lô', 'túi xách'],
    matchRadius: 400,
    timeShape: 1.5,
    timeMedianDays: 1.6,
    diffusion: 0,
    frequency: 0.08,
    attributes: [
      [
        'Loại túi',
        'score',
        0.9,
        false,
        [
          ['Balo', 0.4, ['ba lô']],
          ['Túi xách', 0.25],
          ['Túi tote', 0.1],
          ['Túi đeo chéo', 0.15],
          ['Vali', 0.03],
          ['Khác', 0.07],
        ],
      ],
      ['Màu chủ đạo', 'score', 0.9, false, colorValues(ITEM_COLORS)],
    ],
    contents: [
      'Ví',
      'Điện thoại',
      'Laptop',
      'Giấy tờ tùy thân',
      'Chìa khóa',
      'Sách vở',
      'Mỹ phẩm',
      'Quần áo',
    ],
    relations: [
      ['Ví & tiền', 0.5],
      ['Thiết bị điện tử', 0.4],
    ],
    questions: [
      'Bên trong túi có vật gì dễ nhận biết?',
      'Túi có logo, móc khóa hoặc hình dán nào không?',
    ],
  },
  'Thiết bị điện tử': {
    aliases: ['điện thoại', 'laptop', 'máy tính bảng'],
    matchRadius: 400,
    timeShape: 1.5,
    timeMedianDays: 1.6,
    diffusion: 0,
    frequency: 0.14,
    attributes: [
      [
        'Loại thiết bị',
        'exclude',
        0.95,
        true,
        [
          ['Điện thoại', 0.62, ['smartphone', 'đt']],
          ['Máy tính bảng', 0.06, ['iPad', 'tablet']],
          ['Laptop', 0.1, ['máy tính xách tay']],
          ['Tai nghe', 0.12, ['AirPods', 'headphone']],
          ['Đồng hồ thông minh', 0.04, ['smartwatch']],
          ['Máy ảnh', 0.02],
          ['Khác', 0.04],
        ],
      ],
      [
        'Hãng',
        'score',
        0.9,
        false,
        [
          ['Apple', 0.38, ['iPhone']],
          ['Samsung', 0.27],
          ['Xiaomi', 0.1],
          ['OPPO', 0.12],
          ['Sony', 0.03],
          ['Khác', 0.1],
        ],
      ],
      ['Màu chủ đạo', 'score', 0.9, false, colorValues(ITEM_COLORS)],
    ],
    questions: [
      'Thiết bị có hình nền hoặc ốp lưng đặc biệt nào?',
      'Bạn nhớ một phần mã IMEI hoặc serial không?',
    ],
  },
  'Chìa khóa & xe cộ': {
    aliases: ['chìa khóa xe', 'smartkey'],
    matchRadius: 400,
    timeShape: 1,
    timeMedianDays: 3.5,
    diffusion: 0,
    frequency: 0.08,
    attributes: [
      [
        'Loại',
        'exclude',
        0.95,
        true,
        [
          ['Chìa khóa nhà', 0.3],
          ['Chìa khóa xe máy', 0.4, ['chìa xe']],
          ['Chìa khóa ô tô', 0.08, ['smartkey']],
          ['Xe máy', 0.15],
          ['Xe đạp', 0.07],
        ],
      ],
    ],
    questions: ['Chìa khóa có móc hoặc bao bọc đặc biệt nào?', 'Biển số của xe là gì?'],
  },
  'Trang sức & phụ kiện': {
    aliases: ['trang sức', 'phụ kiện'],
    matchRadius: 400,
    timeShape: 1,
    timeMedianDays: 3.5,
    diffusion: 0,
    frequency: 0.04,
    attributes: [
      [
        'Loại',
        'score',
        0.95,
        true,
        [
          ['Nhẫn', 0.18],
          ['Dây chuyền', 0.2, ['vòng cổ']],
          ['Bông tai', 0.12, ['khuyên tai']],
          ['Lắc tay', 0.12, ['vòng tay']],
          ['Đồng hồ', 0.15],
          ['Kính', 0.15, ['mắt kính']],
          ['Khác', 0.08],
        ],
      ],
      ['Màu chủ đạo', 'score', 0.8, false, colorValues(ITEM_COLORS)],
    ],
    questions: [
      'Món đồ có ký hiệu hoặc chữ khắc nào không?',
      'Bạn còn giữ hộp hoặc giấy bảo hành không?',
    ],
  },
  'Thú cưng': {
    aliases: ['chó', 'mèo', 'vật nuôi', 'pet'],
    matchRadius: 2400,
    timeShape: 0.7,
    timeMedianDays: 12,
    diffusion: 150000,
    frequency: 0.03,
    attributes: [
      [
        'Loài',
        'exclude',
        0.95,
        true,
        [
          ['Chó', 0.55, ['cún', 'cẩu']],
          ['Mèo', 0.35, ['miu']],
          ['Chim', 0.06],
          ['Khác', 0.04],
        ],
      ],
      [
        'Giống',
        'score',
        0.9,
        false,
        [
          ['Chó ta', 0.22, ['chó cỏ']],
          ['Poodle', 0.2, ['chó xù']],
          ['Phốc sóc', 0.1, ['Pomeranian']],
          ['Corgi', 0.08],
          ['Husky', 0.04],
          ['Mèo ta', 0.18],
          ['Mèo Anh lông ngắn', 0.09, ['ALN']],
          ['Mèo Ba Tư', 0.03],
          ['Khác', 0.06],
        ],
      ],
      [
        'Màu lông',
        'score',
        0.9,
        false,
        colorValues({ Nâu: 0.3, Vàng: 0.25, Trắng: 0.15, Đen: 0.12, Xám: 0.06, 'Nhiều màu': 0.12 }),
      ],
    ],
    questions: [
      'Thú cưng có đặc điểm nhận diện hoặc vết thương nào?',
      'Thú cưng đeo vòng cổ hoặc thẻ tên gì?',
    ],
  },
  Khác: {
    aliases: ['đồ khác'],
    matchRadius: 400,
    timeShape: 1,
    timeMedianDays: 3.5,
    diffusion: 0,
    frequency: 0.08,
    attributes: [['Màu chủ đạo', 'score', 0.9, false, colorValues(ITEM_COLORS)]],
    questions: ['Đồ vật có đặc điểm riêng nào giúp xác minh?'],
  },
}

const categoryId = (index) => `CAT-${String(index + 1).padStart(3, '0')}`

export function createAdminCategories() {
  const names = Object.keys(CATEGORY_DETAILS)
  const idOf = (name) => categoryId(names.indexOf(name))

  return Object.entries(CATEGORY_DETAILS).map(([name, detail], categoryIndex) => {
    const id = categoryId(categoryIndex)
    return {
      id,
      name,
      icon: `/images/categories/${CATEGORY_IMAGES[name]}.svg`,
      order: categoryIndex + 1,
      aliases: detail.aliases,
      matchRadius: detail.matchRadius,
      timeShape: detail.timeShape,
      timeMedianDays: detail.timeMedianDays,
      diffusion: detail.diffusion,
      frequency: detail.frequency,
      attributes: detail.attributes.map(
        ([attributeName, matchRole, mProb, isRequired, values], index) => ({
          id: `${id}-attr-${index + 1}`,
          name: attributeName,
          aliases: [],
          matchRole,
          mProb,
          isRequired,
          values: values.map(([value, frequency, aliases], valueIndex) => ({
            id: `${id}-attr-${index + 1}-value-${valueIndex + 1}`,
            value,
            frequency,
            aliases: aliases || [],
          })),
        })
      ),
      contents: (detail.contents || []).map((label, index) => ({
        id: `${id}-content-${index + 1}`,
        label,
      })),
      relations: (detail.relations || []).map(([memberName, ratio], index) => ({
        id: `${id}-relation-${index + 1}`,
        sourceCategoryId: id,
        memberCategoryIds: [idOf(memberName)],
        ratio,
      })),
      questions: detail.questions.map((text, index) => ({
        id: `${id}-question-${index + 1}`,
        text,
      })),
    }
  })
}
