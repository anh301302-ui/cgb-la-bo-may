"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface HistoryItem {
  id: string;
  serverId: string;
  boosts: number;
  boosted: number;
  existing: number;
  failed: number;
  date: string; 
  tokens: string[]; // 👈 Danh sách token đã boost
}

interface HistoryContextType {
  history: HistoryItem[];
  addHistory: (item: Omit<HistoryItem, 'id'>) => void;
  clearHistory: () => void;
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

const HISTORY_KEY = 'boost_history';
const MAX_HISTORY_ITEMS = 500;

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(HISTORY_KEY);
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (error) {
      console.error("Không thể tải lịch sử từ localStorage:", error);
    }
  }, []);

  const addHistory = (item: Omit<HistoryItem, 'id'>) => {
    const newItem: HistoryItem = {
      ...item,
      id: new Date().toISOString() + Math.random().toString(36).substring(2, 9),
    };

    setHistory(prevHistory => {
      const updatedHistory = [newItem, ...prevHistory];
      const trimmedHistory = updatedHistory.slice(0, MAX_HISTORY_ITEMS);
      
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmedHistory));
      } catch (error) {
        console.error("Không thể lưu lịch sử vào localStorage:", error);
      }
      
      return trimmedHistory;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch (error) {
      console.error("Không thể xóa lịch sử:", error);
    }
  };

  return (
    <HistoryContext.Provider value={{ history, addHistory, clearHistory }}>
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistory() {
  const context = useContext(HistoryContext);
  if (context === undefined) {
    throw new Error('useHistory phải được sử dụng bên trong HistoryProvider');
  }
  return context;
}
