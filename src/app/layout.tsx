import "./globals.css"; // 👈 DÒNG QUAN TRỌNG NHẤT BỊ THIẾU
import { HistoryProvider } from '@/contexts/HistoryContext';
import HistoryButton from '@/components/HistoryButton';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        <HistoryProvider>
          {children}
          <HistoryButton />
        </HistoryProvider>
      </body>
    </html>
  );
}
