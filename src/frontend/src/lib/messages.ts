import type { Booking, Offer } from './types'

export function cancellationMessage(booking: Booking) {
  if (booking.status === 'CANCELLED') return 'Lượt đặt đã được hủy.'
  if (booking.cancellation_reason?.includes('already started'))
    return 'Đã đến giờ chơi, không thể hủy.'
  return 'Chỉ có thể hủy trước giờ chơi ít nhất 6 giờ.'
}

export function offerMessage(offer: Offer) {
  if (offer.eligible) return 'Đang áp dụng cho lượt đặt mới.'
  if (offer.status === 'CANCELLED')
    return 'Lịch ưu đãi đã hủy, không tự bật lại.'
  if (offer.status === 'DEACTIVATED') return 'Ưu đãi đã tắt, không tự bật lại.'
  if (offer.status === 'EXPIRED') return 'Đã đến giờ chơi; ưu đãi hết hiệu lực.'
  if (offer.reason?.includes('lead-time'))
    return 'Chưa đến thời điểm tự áp dụng. Slot vẫn dùng giá thường.'
  if (offer.reason?.includes('below'))
    return 'Giá ưu đãi phải thấp hơn giá thường hiện tại. Cấu hình được giữ để kiểm tra lại.'
  return 'Đang chờ sân và slot đủ điều kiện: còn hoạt động, đã công bố, trống và không bị chặn. Cấu hình ưu đãi được giữ nguyên.'
}
