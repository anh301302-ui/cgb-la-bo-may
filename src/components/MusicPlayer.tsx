"use client";

import { useState, useEffect } from "react";

let globalAudio: HTMLAudioElement | null = null;
let globalIsPlaying = false;
const globalListeners: Set<(playing: boolean) => void> = new Set();

function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!globalAudio) {
    globalAudio = new Audio("https://files.catbox.moe/9cwae0.mp3");
    globalAudio.loop = true;
    globalAudio.volume = 0.5;

    const savedTime = sessionStorage.getItem("music_position");
    if (savedTime) {
      globalAudio.currentTime = parseFloat(savedTime) || 0;
    }

    setInterval(() => {
      if (globalAudio && !globalAudio.paused) {
        sessionStorage.setItem("music_position", String(globalAudio.currentTime));
      }
    }, 1000);
  }
  return globalAudio;
}

export default function MusicPlayer() {
  const [isPlaying, setIsPlaying] = useState(globalIsPlaying);

  useEffect(() => {
    const audio = getAudio();
    if (!audio) return;

    const listener = (playing: boolean) => setIsPlaying(playing);
    globalListeners.add(listener);

    const handleFirstClick = () => {
      if (audio.paused) {
        audio.play().then(() => {
          globalIsPlaying = true;
          globalListeners.forEach(l => l(true));
        }).catch(() => {});
      }
      document.removeEventListener("click", handleFirstClick);
    };

    if (audio.paused) {
      document.addEventListener("click", handleFirstClick);
    }

    return () => {
      globalListeners.delete(listener);
      document.removeEventListener("click", handleFirstClick);
    };
  }, []);

  const togglePlay = () => {
    const audio = getAudio();
    if (!audio) return;

    if (audio.paused) {
      audio.play().then(() => {
        globalIsPlaying = true;
        globalListeners.forEach(l => l(true));
      }).catch(() => {});
    } else {
      audio.pause();
      globalIsPlaying = false;
      globalListeners.forEach(l => l(false));
    }
  };

  return (
    <div className="fixed bottom-6 left-6 z-50">
      <button
        onClick={togglePlay}
        className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-800/80 text-white shadow-lg hover:bg-gray-700 transition-colors border border-gray-600 backdrop-blur-sm"
        title={isPlaying ? "Tắt nhạc" : "Bật nhạc"}
      >
        {isPlaying ? (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
          </svg>
        )}
      </button>
    </div>
  );
}
