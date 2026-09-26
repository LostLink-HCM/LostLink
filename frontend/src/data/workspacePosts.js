import { moderatorPosts } from './moderatorPosts.js'

export const workspacePostMatches = [
  { id: 'M-101', postLost: 1, postFound: 101, score: .94 },
  { id: 'M-104', postLost: 104, postFound: 4, score: .91 },
  { id: 'M-105', postLost: 105, postFound: 4, score: .78 },
  { id: 'M-108', postLost: 8, postFound: 108, score: .96 },
]

const matchingPosts = [
  { id: 101, title: 'Nhặt được ví da nâu có CCCD trên đường Lê Lợi', category: 'Ví / Giấy tờ', type: 'found', dateTime: '06/09/2026 10:00', location: 'Đường Lê Lợi, Quận 1', district: 'Quận 1', status: 'searching', author: 'Minh Anh', views: 36, comments: 1, desc: 'Ví da nâu có CCCD mang tên Nguyễn Văn A và thẻ Vietcombank. Người nhận vui lòng xác minh thông tin giấy tờ.', images: ["https://cdn.hstatic.net/products/200001019424/nvn-103-br-03__2__91ee123f5d5d4625991ba4a7dbd26fa8_large.jpg"] },
  { id: 104, title: 'Tìm chùm chìa khóa Honda có móc gấu dâu', category: 'Chìa khóa', type: 'lost', dateTime: '04/09/2026 08:10', location: 'Công viên Gia Định, Gò Vấp', district: 'Gò Vấp', status: 'contacted', author: 'Hoàng Nam', views: 54, comments: 2, desc: 'Chùm ba chìa khóa, gồm chìa xe Honda và chìa nhà, gắn móc hình gấu dâu. Có thể đã để quên trên ghế đá.', images: [] },
  { id: 105, title: 'Rơi chìa khóa xe Honda gần Công viên Gia Định', category: 'Chìa khóa', type: 'lost', dateTime: '04/09/2026 09:00', location: 'Đường Hoàng Minh Giám, Gò Vấp', district: 'Gò Vấp', status: 'searching', author: 'Thu Hà', views: 27, comments: 0, desc: 'Rơi chùm chìa khóa xe Honda kèm chìa nhà và móc khóa màu hồng khi đi bộ gần công viên.', images: [] },
  { id: 108, title: 'Nhặt được AirPods Pro 2 có khắc tên Minh', category: 'Đồ điện tử', type: 'found', dateTime: '04/09/2026 20:30', location: 'Crescent Mall, Quận 7', district: 'Quận 7', status: 'searching', author: 'Phương Linh', views: 62, comments: 1, desc: 'Tai nghe AirPods Pro 2 trong hộp sạc trắng khắc tên Minh, nhặt được tại khu vực ghế chờ.', images: [] },
]

export function createWorkspacePosts() {
  const posts = [...moderatorPosts, ...matchingPosts]
  const sequenceByDate = new Map()
  const postCodes = new Map()
  const chronologicalPosts = [...posts].sort((a, b) => {
    const [aDate, aTime] = a.dateTime.split(' ')
    const [bDate, bTime] = b.dateTime.split(' ')
    const [aDay, aMonth, aYear] = aDate.split('/').map(Number)
    const [bDay, bMonth, bYear] = bDate.split('/').map(Number)
    return Date.UTC(aYear, aMonth - 1, aDay, ...aTime.split(':').map(Number)) - Date.UTC(bYear, bMonth - 1, bDay, ...bTime.split(':').map(Number))
  })

  chronologicalPosts.forEach((post) => {
    const [day, month, year] = post.dateTime.split(' ')[0].split('/')
    const dateCode = `${year.slice(-2)}${month.padStart(2, '0')}${day.padStart(2, '0')}`
    const sequence = (sequenceByDate.get(dateCode) || 0) + 1
    sequenceByDate.set(dateCode, sequence)
    postCodes.set(post, `${post.type === 'lost' ? 'L' : 'F'}${dateCode}${sequence}`)
  })

  return posts.map((post) => ({
    ...post,
    postCode: postCodes.get(post),
    matches: workspacePostMatches.filter((match) => match.postLost === post.id || match.postFound === post.id).length,
  }))
}
