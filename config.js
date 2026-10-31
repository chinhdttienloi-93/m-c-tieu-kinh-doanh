/* ============================================================
   CẤU HÌNH ỨNG DỤNG — bạn có thể sửa trực tiếp file này trên GitHub
   (bấm vào file → biểu tượng bút chì → sửa → Commit changes).
   Cloudflare sẽ tự cập nhật sau khoảng 1 phút.
   ============================================================ */
window.TL_CONFIG = {
  APP_NAME: 'TL Sales Performance',
  APP_SUBTITLE: 'Nền tảng Quản trị mục tiêu kinh doanh – Phòng Kinh doanh',
  COMPANY: 'Tiến Lợi Group',

  // Dán đường link Lark Base của bạn vào đây để có nút "Mở Lark Base"
  BASE_URL: '',

  // Ngưỡng tô màu mức đạt mục tiêu (so với tiến độ thời gian của kỳ)
  THRESHOLD_GREEN: 0.95,   // ≥ 95% tiến độ yêu cầu → xanh (Đạt)
  THRESHOLD_AMBER: 0.80,   // 80–95% → vàng (Cảnh báo); dưới 80% → đỏ (Rủi ro)

  // Cảnh báo năng lực: mục tiêu NVKD > 150% sản lượng bình quân 3 tháng gần nhất
  CAPACITY_WARN: 1.5,

  // Danh sách nhóm sản phẩm (thứ tự hiển thị)
  PRODUCTS: ['MẠ MÀU', 'MẠ LẠNH', 'MẠ KẼM', 'CÁN NÓNG', 'HÓA CHẤT', 'XUẤT KHẨU'],

  // Ngày bán hàng trong tuần (0 = Chủ nhật). Mặc định nghỉ Chủ nhật.
  OFF_DAYS: [0],

  // Dữ liệu demo chỉ dùng khi chưa kết nối Lark. Đặt false để tắt hẳn.
  ALLOW_DEMO: true,
};
