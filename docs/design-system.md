# Sweet Shop — Design system (tokens)

Bám sát bản thiết kế UI (21 màn) khi dựng giao diện. Phong cách: tiệm bánh ấm áp,
casual game, nút bo tròn có "bóng đúc" (chunky), KHÔNG dùng emoji làm icon (dùng SVG).

## Màu

| Token | Hex | Dùng cho |
|---|---|---|
| `--bg-cream` | `#FBEFDD` | nền app |
| `--bg-warm` | `#EAD9BE` | nền cảnh tiệm |
| `--surface` | `#FFFFFF` | thẻ/card |
| `--ink` | `#4A2B1A` | chữ chính |
| `--ink-strong` | `#7A3E12` | tiêu đề |
| `--ink-muted` | `#7A5C47` | chữ phụ (5.4:1 trên nền kem — đạt AA; bản cũ `#8A6A54` chỉ 4.3:1) |
| `--primary` | `#A45A17` | nút chính / accent (5.2:1 với chữ trắng — đạt AA; mockup cũ `#B5651D` chỉ 4.3:1) |
| `--primary-shadow` | `#6E3810` | bóng đúc nút chính |
| `--caramel` | `#D98A3D` | nhấn phụ |
| `--strawberry` | `#E28B9B` | hồng kem / tim / nhấn (nền trang trí, KHÔNG đặt chữ trắng) |
| `--strawberry-strong` | `#B84A60` | nền hồng có chữ trắng (pill "khách đang chờ") |
| `--mint` | `#6FA678` | success / tiến độ |
| `--coin` | `#E7B23C` | xu (viền `#C9922A`) |
| `--gem` | `#7C6BD6` | icon gem (viền `#5B4BB0`) |
| `--gem-strong` | `#6B5AC4` | nút gem có chữ trắng (5.4:1) |
| `--border` | `#E4CFA8` | viền mềm |
| `--placeholder-bg` | `#FFF6E9` | ô ảnh nguyên liệu |
| `--placeholder-dash` | `#D9B98A` | viền gạch đứt ô ảnh |

Tương phản (WCAG AA ≥ 4.5:1 cho chữ thường): chữ trắng chỉ đặt trên `--primary`,
`--strawberry-strong`, `--gem-strong`, `--mint-strong`; không đặt chữ trắng trên `--caramel`,
`--strawberry`, `--gem`. Chữ phụ tối thiểu `--ink-muted`. Token nằm trong `app/globals.css`.

## Typography

- Display (tiêu đề): **Baloo 2** (500/600/700). Mockup dùng Fredoka nhưng Fredoka **không có
  bộ chữ tiếng Việt** (dấu bị rơi sang font khác), nên bản code dùng Baloo 2 — cùng phong cách tròn.
- Body: **Nunito** (variable).
- Nạp qua `next/font/google` trong `app/layout.tsx` (subset `latin` + `vietnamese`).

## Hình khối

- Bo góc: thẻ 16–22px, nút 14–20px, pill 999px.
- Bóng nút "chunky": `box-shadow: 0 4px 0 <primary-shadow>` (nhấn thì dịch xuống).
- Bóng thẻ: `0 4px 0 #EADFC8` (tông ấm, không dùng bóng xám mờ kiểu mặc định).
- Khung điện thoại thiết kế: 390×844.

## Icon & ảnh

- Icon: inline SVG (stroke `currentColor`), không emoji.
- Ảnh nguyên liệu/dụng cụ/bánh: ảnh gốc ở `assets/source/` (Vecteezy, xem `assets/CREDITS.md`),
  `npm run assets:build` xuất webp vuông vào `public/images/`. Món chưa có ảnh: icon SVG
  (`components/ItemImage.tsx`) hoặc ô placeholder gạch đứt.

## Tiền tệ hiển thị

- Xu: biểu tượng `₵` + số có phân tách nghìn ("2.480 ₵").
- Gem: icon kim cương SVG tím + số.
