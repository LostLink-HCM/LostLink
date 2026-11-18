// Ảnh đại diện mẫu cho tài khoản seed, nhiều chủ đề để giao diện trông giống dữ liệu thật.
// Ảnh vẽ sinh từ DiceBear (https://www.dicebear.com/licenses), ảnh chụp lấy từ Wikimedia Commons,
// source là trang gốc ghi tác giả và giấy phép. null = để trống, hiện chữ viết tắt

const DICEBEAR = 'https://api.dicebear.com/9.x'
const COMMONS = 'https://commons.wikimedia.org/wiki/Special:FilePath'

// Phong cách vẽ của DiceBear và giấy phép của bộ hình
const STYLES = {
  anime: { style: 'lorelei', license: 'CC0 1.0' },
  sketch: { style: 'notionists', license: 'CC0 1.0' },
  adventurer: { style: 'adventurer', license: 'CC BY 4.0, Lisa Wischofsky' },
  emoji: { style: 'fun-emoji', license: 'CC BY 4.0, Davis Uche' },
  doodle: { style: 'croodles', license: 'CC BY 4.0, vijay verma' },
  robot: { style: 'bottts', license: 'Free for personal and commercial use, Pablo Stanley' },
  shapes: { style: 'shapes', license: 'CC0 1.0' },
  rings: { style: 'rings', license: 'CC0 1.0' },
  glass: { style: 'glass', license: 'CC0 1.0' },
}

const drawn = (kind, seed) => {
  const { style, license } = STYLES[kind]
  return {
    url: `${DICEBEAR}/${style}/svg?seed=${encodeURIComponent(seed)}`,
    source: `DiceBear ${style} (${license})`,
  }
}

// Special:FilePath chuyển tới bản thu nhỏ 256px của tệp trên Commons
const photo = (file) => ({
  url: `${COMMONS}/${encodeURIComponent(file)}?width=256`,
  source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}`,
})

const PETS = {
  shiba: photo('Shiba_inu_taiki.jpg'),
  cat: photo('Cat03.jpg'),
}

const NATURE = {
  lotus: photo('Nelumbo_nucifera_01.JPG'),
  apricotBlossom: photo('Ochna_integerrima_02.JPG'),
  cactusFlower: photo('Echinopsis_unidentified.jpg'),
  bulbul: photo('Red-whiskered_bulbul_(Pycnonotus_jocosus_fuscicaudatus).jpg'),
  hummingbird: photo('Vervain_hummingbird_(Mellisuga_minima).jpg'),
  seaTurtle: photo('Green_sea_turtle_(Chelonia_mydas)_Moorea.jpg'),
}

const VIETNAM = {
  benThanh: photo('Ben_Thanh_market_2.jpg'),
  notreDame: photo('Ho_Chi_Minh_City,_Notre-Dame_Basilica,_2020-01_CN-01.jpg'),
  bitexco: photo('Ho_Chi_Minh_City,_Bitexco_Financial_Tower,_2020-01_CN-01.jpg'),
  haLong: photo('Ha_Long_Bay_in_2019.jpg'),
  terraces: photo('Golden-terraced-fields-in-Mu-Cang-Chai.jpg'),
}

const FOOD = {
  icedCoffee: photo('Vietnamese_iced_coffee_-_Jan_31,_2018.jpg'),
  pho: photo('Phở_bò_in_a_German_restaurant_02.jpg'),
  banhXeo: photo('Bánh_xèo_1.jpg'),
  bubbleTea: photo('Classic_bubble_tea.jpg'),
}

// username → ảnh đại diện
const AVATARS = {
  admin: drawn('robot', 'lostlink-admin'),
  moderator: drawn('sketch', 'moderator'),
  moderator02: drawn('rings', 'moderator02'),
  moderator03: null,
  user01: drawn('anime', 'user01'),

  'minhkhoi.td': PETS.shiba,
  'hoangnam.q1': drawn('adventurer', 'hoangnam'),
  'baotran.sg': drawn('anime', 'baotran'),
  'ngockhanh.dn': VIETNAM.haLong,
  'thuylinh.hn': PETS.cat,
  'ducanh.bk': null,
  'quocbao.gv': FOOD.icedCoffee,
  'thanhhuong.bt': NATURE.lotus,
  'vanhieu.td': VIETNAM.bitexco,
  'kimngan.q7': drawn('shapes', 'kimngan'),
  'tuananh.tb': VIETNAM.terraces,
  'myduyen.pn': FOOD.bubbleTea,
  'hoaiphuong.q3': NATURE.apricotBlossom,
  'giahuy.q10': NATURE.seaTurtle,
  'thuytien.bc': drawn('anime', 'thuytien'),
  'minhtri.hm': FOOD.pho,
  'ngocanh.q5': NATURE.hummingbird,
  'dangkhoa.nb': VIETNAM.notreDame,
  'phuongvy.q4': NATURE.cactusFlower,
  'hoanglong.cc': drawn('doodle', 'hoanglong'),
  'thaovy.q11': drawn('emoji', 'thaovy'),
  'duchuy.bth': null,
  'baongoc.q6': NATURE.bulbul,
  'trungkien.q8': VIETNAM.benThanh,
  'lananh.tp': FOOD.banhXeo,
  'congminh.q12': drawn('glass', 'congminh'),
}

// Ảnh do seed gán, seed chạy lại được phép thay; ảnh người dùng tự tải lên thì giữ nguyên
const SEEDED_AVATAR = /^https:\/\/(api\.dicebear\.com|commons\.wikimedia\.org)\//

module.exports = { AVATARS, SEEDED_AVATAR }
