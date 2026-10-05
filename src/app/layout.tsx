// app/layout.tsx
import { HistoryProvider } from '@/contexts/HistoryContext'; // 1. Import cái hộp vào
import HistoryButton from '@/components/HistoryButton'; // 2. Import nút lịch sử (để hiện ở góc phải)

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        {/* 3. Bọc toàn bộ children (các trang web của bạn) bằng HistoryProvider */}
        <HistoryProvider>
          {children}
          
          {/* Đặt nút Lịch sử ở đây để nó hiện ở mọi trang */}
          <HistoryButton />
        </HistoryProvider>
      </body>
    </html>
  );
}
