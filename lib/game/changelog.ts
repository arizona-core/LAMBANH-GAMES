// Nhật ký cập nhật hiển thị cho người chơi (màn /updates). Bản mới nhất đặt ĐẦU danh sách.
// Mỗi lần deploy tính năng mới: thêm 1 mục (hoặc thêm dòng vào mục cùng ngày).

export type ChangelogEntry = {
  date: string; // YYYY-MM-DD (giờ Việt Nam)
  title: string;
  items: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-09-30",
    title: "Cửa hàng hoàn chỉnh & khách kiên nhẫn hơn",
    items: [
      "Mỗi khách giờ chờ tối đa 4 phút (cả lúc xếp hàng lẫn lúc chờ bánh).",
      "Lò nướng hiện ngay trong tiệm và đổi hình theo bậc: lò đối lưu, lò gạch có lửa, lò thông minh. Lò trong mini-game cũng đổi theo.",
      "Tủ trưng bày trên quầy đổi theo bậc: tủ kính đèn LED, tủ lạnh 2 tầng, quầy đá cẩm thạch viền vàng.",
      "Mỗi theme có bộ trang trí riêng: Pastel (chấm bi, bóng bay), Gỗ mộc (sàn ván, bảng phấn, cây treo), Trung Thu (trăng rằm, đèn ông sao), Giáng sinh (cây thông, tuyết rơi).",
      "Cửa hàng có hình minh hoạ từng món và nút “Xem trước” tiệm của bạn khi có món đó. Mua theme xong được áp dụng ngay.",
      "Thêm mục “Bản cập nhật” này để theo dõi thay đổi theo ngày.",
    ],
  },
  {
    date: "2026-09-29",
    title: "Sổ công thức 72 món, đóng cửa tiệm & nhiệm vụ hằng ngày",
    items: [
      "Sổ công thức làm lại chuẩn: 72 món bánh với 48 nguyên liệu (bánh mì = bột + nước + men + muối + đường…).",
      "Thêm cách nấu “Làm lạnh” cho tiramisu, panna cotta, mousse, tart socola.",
      "Kho và tô trộn chia nhóm nguyên liệu cho dễ tìm.",
      "Tiệm tự đóng cửa khi bạn offline — khách về không bị trừ uy tín. Có nút Đóng/Mở cửa ở màn Tiệm.",
      "Nhiệm vụ hằng ngày: mỗi ngày 15 nhiệm vụ ngẫu nhiên (trong 51 loại), thưởng xu, gem và XP.",
    ],
  },
  {
    date: "2026-09-28",
    title: "Ra mắt Sweet Shop",
    items: [
      "Mở tiệm, đồng hồ game (1 giờ game = 1 phút) và 500 khách NPC với tính cách riêng.",
      "Làm bánh theo đơn: chọn nguyên liệu, cách nấu, sốt, topping, đóng gói rồi giao cho khách.",
      "Đánh giá của khách, trang trí tiệm và cảnh tiệm isometric có khách đi lại.",
      "Bảng xếp hạng có vương miện, huy hiệu hạng; lúc đông lúc vắng theo giờ game.",
      "Danh sách người chơi online/offline, hồ sơ quán, tiểu sử và ảnh đại diện.",
      "Cài app về điện thoại (PWA).",
    ],
  },
];

export const LATEST_UPDATE = CHANGELOG[0].date;
/** localStorage: ngày bản cập nhật mới nhất người chơi đã xem (để hiện nhãn "Mới"). */
export const UPDATES_SEEN_KEY = "sweetshop.updates.seen";

/** "2026-09-30" → "30/09/2026" */
export function formatUpdateDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}
