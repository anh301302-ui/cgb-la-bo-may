import "./globals.css";
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
          {/* 👇 VIDEO NỀN CHUNG CHO TOÀN BỘ WEB */}
          <video 
            src="https://files.catbox.moe/hdwtfm.mp4" 
            autoPlay 
            loop 
            muted 
            playsInline
            className="fixed inset-0 w-full h-full object-cover z-0 opacity-100"
          />
          <div className="fixed inset-0 bg-black/20 z-0" />

          {/* NỘI DUNG CÁC TRANG */}
          <div className="relative z-10">{children}</div>
          
          <HistoryButton />
        </HistoryProvider>
      </body>
    </html>
  );
}
