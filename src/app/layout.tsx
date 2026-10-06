import "./globals.css";
import { HistoryProvider } from '@/contexts/HistoryContext';
import HistoryButton from '@/components/HistoryButton';

// 👇 CẤU HÌNH LOGO TAB TRÌNH DUYỆT (FAVICON)
export const metadata = {
  title: 'CGB La Bo May',
  description: 'Automated Boost System',
  icons: {
    icon: 'https://files.catbox.moe/0wx2ee.jpg', // Link ảnh của bạn
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        <HistoryProvider>
          {/* 👇 THÊM NHẠC NỀN Ở ĐÂY */}
          <audio autoPlay loop className="hidden">
            {/* Thay link MP3 của bạn vào đây */}
            <source src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" type="audio/mpeg" />
            Trình duyệt của bạn không hỗ trợ thẻ audio.
          </audio>

          {children}
          
          <HistoryButton />
        </HistoryProvider>
      </body>
    </html>
  );
}
