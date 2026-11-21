const postDate = (createdAt) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(createdAt))

const categoryArchiveMessage = (post, categoryName) => {
  const introduction = `Bài đăng “${post.title}” (đăng ngày ${postDate(post.createdAt)}) đang thuộc danh mục “${categoryName}” đã ngừng sử dụng.`
  const matching =
    post.status === 'pending'
      ? 'Bài đăng chưa thể nhận gợi ý ghép cặp mới từ danh mục này.'
      : 'Bài đăng sẽ ngừng nhận gợi ý ghép cặp mới.'
  const preserved = 'Các gợi ý và cuộc trao đổi đã có vẫn được giữ lại.'
  const guidance =
    post.status === 'contacted'
      ? 'Bài đang ở trạng thái Đã liên hệ nên hiện chưa thể chỉnh sửa. Bạn vẫn có thể tiếp tục các yêu cầu liên hệ, xác minh và hội thoại đã có.'
      : 'Để tiếp tục nhận gợi ý, vui lòng chỉnh sửa bài đăng và chọn một danh mục đang hoạt động. Bài sẽ chờ duyệt lại; các gợi ý đang chờ sẽ được xét lại sau khi duyệt. Hội thoại và tin nhắn cũ vẫn được giữ.'
  return [introduction, matching, preserved, guidance].join(' ')
}

module.exports = { categoryArchiveMessage }
