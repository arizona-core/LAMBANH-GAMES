// Chuyển giữa các màn trong game: chỉ hiện thanh tải mảnh ở đầu trang (không che toàn màn hình).
export default function GameLoading() {
  return (
    <div className="app" aria-busy="true" aria-label="Đang tải">
      <div className="top-progress" />
    </div>
  );
}
