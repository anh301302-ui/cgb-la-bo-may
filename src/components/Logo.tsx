// src/components/Logo.tsx

export function Logo({ size = 48, showText = true }: { size?: number; showText?: boolean }) {
  return (
    <img
      src="https://files.catbox.moe/0wx2ee.jpg"
      alt="Logo"
      style={{ width: size, height: size }}
      className="object-cover rounded-full border-2 border-white/30 shadow-lg"
    />
  );
}
