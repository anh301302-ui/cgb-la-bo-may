# 🚀 Discord Token Auto-Joiner Bot

**Tự động thêm Discord token vào server và boost được thiết kế an toàn, nhanh chóng và dễ sử dụng.**

> ⚠️ **Disclaimer**: Project này chỉ dành cho mục đích giáo dục. Bạn chịu trách nhiệm hoàn toàn khi sử dụng. Tuân thủ [Discord ToS](https://discord.com/terms).

---

## ✨ Tính Năng

✅ **Thêm Token Tự Động** - Thêm Discord token vào server chỉ với URL  
✅ **Boost Server** - Tăng boost cho server sau khi thêm token  
✅ **Xác Thực CAPTCHA** - GeeTest v4 protection chống bot  
✅ **Đa Giao Thức** - OAuth2 + User token support  
✅ **Giới Hạn Rate** - Tự động chống spam/abuse  
✅ **Ghi Nhật Ký Bảo Mật** - Không log token hoặc secret  
✅ **Phòng CSRF** - Origin validation trên tất cả mutations  

---

## 🔒 Security Features

- 🔐 **Token Redaction** - Discord tokens tự động ẩn trong logs
- 🔐 **OAuth2 Protection** - Client secrets không bao giờ lộ
- 🔐 **Distributed Rate Limiting** - Vercel KV chống VPN/proxy bypass
- 🔐 **CSRF Protection** - Origin header validation trên tất cả mutations
- 🔐 **Graceful Fallback** - Hoạt động bình thường nếu KV không sẵn có

---

## 🛠️ Stack Công Nghệ

- **Framework**: Next.js 16 (App Router)
- **Authentication**: OAuth2 + JWT
- **Database**: Vercel KV (Redis)
- **Rate Limiting**: Vercel KV + In-memory fallback
- **CAPTCHA**: GeeTest v4
- **UI**: React 19 + Tailwind CSS + Framer Motion
- **Deployment**: Vercel

---

## 📋 Yêu Cầu

### Trước Khi Deploy

1. **Discord Developer Portal** ([discord.com/developers](https://discord.com/developers))
   - Tạo Application
   - Lấy `Client ID` và `Client Secret`
   - Thêm Redirect URI: `https://your-domain.com/api/auth/callback`
   - Tạo Bot → Lấy Bot Token
   - Gán quyền: `MANAGE_GUILD_EXPRESSIONS`, `CREATE_INSTANT_INVITE`

2. **GeeTest CAPTCHA** ([geetest.com](https://www.geetest.com))
   - Đăng ký tài khoản
   - Lấy `Captcha ID` và `Captcha Key`

3. **Vercel Account** ([vercel.com](https://vercel.com))
   - Deploy project
   - Tạo Vercel KV database
   - Lấy `KV_REST_API_URL` và `KV_REST_API_TOKEN`

---

## 🚀 Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/Nguoibianhz/TokenAutoJoiner.git
cd TokenAutoJoiner
npm install
```

### 2. Cấu Hình Environment

Copy `.env.example` → `.env.local`:

```bash
cp .env.example .env.local
```

Điền các biến:

```env
# Discord
BOT_TOKEN=your_bot_token_here
OAUTH2_CLIENT_ID=your_client_id
OAUTH2_CLIENT_SECRET=your_client_secret
OAUTH2_REDIRECT_URI=https://your-domain.com/api/auth/callback

# Security
JWT_SECRET=generate_32_char_random_secret_here
CSRF_SECRET=another_32_char_random_secret

# GeeTest CAPTCHA
CAPTCHA=true
GEETEST_ID=your_geetest_id
GEETEST_KEY=your_geetest_key

# Vercel KV (Redis)
KV_REST_API_URL=https://your-kv.kv.vercel-storage.com
KV_REST_API_TOKEN=your_kv_token

# Cron jobs
CRON_SECRET=32_char_random_secret

# App
NEXT_PUBLIC_APP_URL=https://your-domain.com
NODE_ENV=production
```

### 3. Deploy to Vercel

```bash
npm run build
npm run start
```

Hoặc push lên GitHub → Vercel tự động deploy

---

## 📱 Sử Dụng

### User Flow

```
1. Vào https://your-domain.com
2. Chọn server Discord
3. Hoàn thành CAPTCHA
4. Paste Discord tokens (mỗi dòng một token)
5. Xác nhận tokens
6. Tự động boost server
7. Xem kết quả
```

### API Endpoints

| Endpoint | Method | Mục Đích |
|----------|--------|---------|
| `/api/session/create` | POST | Tạo session mới |
| `/api/tokens/validate` | POST | Xác minh tokens |
| `/api/tokens/boost-one` | POST | Boost một token |
| `/api/auth/callback` | GET | OAuth2 callback |
| `/api/cron/cleanup` | POST | Cron cleanup job |

---

## 🔐 Security Notes

### Bảo Vệ Token

- **Không bao giờ log tokens** - Tự động ẩn trong logs
- **Không chia sẻ tokens** - Chỉ xử lý server-side
- **HTTPS chắc chắn** - Mã hóa tất cả requests

### Rate Limiting

- **8 tokens/hour** - Per session
- **32 tokens/day** - Per IP address
- **Vercel KV enforcement** - Chống bypass VPN/proxy

### CAPTCHA

- **GeeTest v4** - Anti-bot protection
- **Server-side validation** - Xác nhận trên server
- **Chống reuse** - Mỗi CAPTCHA chỉ dùng 1 lần

---

## 📊 Deployment

### Deploy to Vercel (Recommended)

```bash
# 1. Push to GitHub
git push origin main

# 2. Vercel auto-deploys
# Monitor at https://vercel.com/dashboard

# 3. Add Environment Variables
# Vercel Dashboard → Settings → Environment Variables
# Add all vars from .env.example
```

### Local Development

```bash
npm run dev
# Visit http://localhost:3000
```

---

## 🐛 Troubleshooting

### "Token exchange failed"
- ✓ Kiểm tra `OAUTH2_CLIENT_SECRET` đúng
- ✓ Kiểm tra `OAUTH2_REDIRECT_URI` khớp Discord app
- ✓ Kiểm tra Discord bot có `CREATE_INSTANT_INVITE` permission

### "Rate limit reached"
- ✓ Chờ 1 giờ (session limit reset)
- ✓ Chờ 24 giờ (IP limit reset)
- ✓ Hoặc dùng IP khác

### "CAPTCHA failed"
- ✓ Kiểm tra `GEETEST_ID` và `GEETEST_KEY` đúng
- ✓ Kiểm tra server time đúng (phải UTC)

### "KV unavailable"
- ✓ Kiểm tra `KV_REST_API_URL` và token đúng
- ✓ Vẫn hoạt động bình thường (fallback to in-memory)

---

## 📚 Documentation

- [Security Fixes](./SECURITY_FIXES.md) - Bảo mật chi tiết
- [API Reference](./docs/API.md) - API documentation
- [Deployment Guide](./docs/DEPLOYMENT.md) - Deploy hướng dẫn

---

## ⚖️ Legal

**Disclaimer**: Dự án này chỉ để học tập. Bạn chịu trách nhiệm pháp lý toàn bộ khi sử dụng.

- Tuân thủ [Discord ToS](https://discord.com/terms)
- Không dùng để spam, hack, hay gây hại
- Tôn trọng quyền riêng tư người khác

---

## 📞 Support

Gặp vấn đề? 

1. Kiểm tra [Troubleshooting](#-troubleshooting)
2. Đọc [Security Fixes](./SECURITY_FIXES.md)
3. Kiểm tra Vercel logs
4. Mở GitHub issue

---

## 📜 License

MIT License - Xem [LICENSE](./LICENSE) để chi tiết

---

## 🙏 Credits

Built with ❤️ for the Discord community.

**Contributors**: Hiếu Nguyễn

---

**Last Updated**: 2026-08-05  
**Version**: 2.1.0 (Security Hardened)
