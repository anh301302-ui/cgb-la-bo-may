"use client";

import { useState } from 'react';
import { useHistory, HistoryItem } from '@/contexts/HistoryContext';

export default function HistoryButton() {
  const [isOpen, setIsOpen] = useState(false);
  const { history, clearHistory } = useHistory();

  const handleClearAll = () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử? (Lần 1/3)")) {
      if (window.confirm("Hành động này KHÔNG THỂ hoàn tác! Bạn vẫn muốn tiếp tục? (Lần 2/3)")) {
        if (window.confirm("XÁC NHẬN LẦN CUỐI: Xóa vĩnh viễn toàn bộ lịch sử? (Lần 3/3)")) {
          clearHistory();
          setIsOpen(false);
        }
      }
    }
  };

  return (
    <>
      {/* 👇 NÚT 3 CHẤM Ở GÓC TRÊN BÊN PHẢI */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-6 right-6 z-50 flex items-center justify-center w-10 h-10 rounded-full bg-gray-800/80 text-white shadow-lg hover:bg-gray-700 transition-colors border border-gray-600 backdrop-blur-sm"
        title="Xem lịch sử Boost"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
        </svg>
        {history.length > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
            {history.length > 99 ? '99+' : history.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4">
          <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-lg bg-[#1a1a1a] text-gray-200 shadow-xl border border-gray-700">
            
            <div className="flex items-center justify-between border-b border-gray-700 p-4">
              <h2 className="text-lg font-semibold uppercase tracking-wider text-gray-300">Lịch sử Boost</h2>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="overflow-y-auto p-4 flex-1">
              {history.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Chưa có lịch sử boost nào.</p>
              ) : (
                <div className="space-y-4">
                  {history.map((item) => (
                    <HistoryCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>

            {history.length > 0 && (
              <div className="border-t border-gray-700 p-4">
                <button 
                  onClick={handleClearAll}
                  className="w-full rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
                >
                  Xóa toàn bộ lịch sử
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function HistoryCard({ item }: { item: HistoryItem }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-[#222] p-4">
      <div className="mb-3 flex items-center justify-between text-xs text-gray-400">
        <span>Ngày: {item.date}</span>
        <span>Server ID: {item.serverId}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4 mb-4">
        <div className="rounded-md bg-[#2a2a2a] p-2 border border-gray-700">
          <div className="text-xl font-bold text-white">{item.boosts}</div>
          <div className="text-[10px] uppercase text-gray-500 tracking-wider">Boosts</div>
        </div>
        <div className="rounded-md bg-[#2a2a2a] p-2 border border-gray-700">
          <div className="text-xl font-bold text-white">{item.boosted}</div>
          <div className="text-[10px] uppercase text-gray-500 tracking-wider">Boosted</div>
        </div>
        <div className="rounded-md bg-[#2a2a2a] p-2 border border-gray-700">
          <div className="text-xl font-bold text-white">{item.existing}</div>
          <div className="text-[10px] uppercase text-gray-500 tracking-wider">Existing</div>
        </div>
        <div className="rounded-md bg-[#2a2a2a] p-2 border border-gray-700">
          <div className="text-xl font-bold text-white">{item.failed}</div>
          <div className="text-[10px] uppercase text-gray-500 tracking-wider">Failed</div>
        </div>
      </div>

      {item.tokens && item.tokens.length > 0 && (
        <div className="border-t border-gray-700 pt-3">
          <p className="text-[10px] uppercase text-gray-500 tracking-wider mb-2">Token đã boost:</p>
          <div className="flex flex-wrap gap-2">
            {item.tokens.map((token, idx) => (
              <span key={idx} className="bg-[#2a2a2a] text-gray-300 text-[10px] px-2 py-1 rounded border border-gray-700 font-mono">
                {token}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
