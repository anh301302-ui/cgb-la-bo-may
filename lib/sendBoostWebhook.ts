// lib/sendBoostWebhook.ts

export async function sendBoostWebhook({
  serverId,
  boosts,
  boosted,
  existing,
  failed,
}: {
  serverId: string;
  boosts: number;
  boosted: number;
  existing: number;
  failed: number;
}) {
  const webhookUrl = "https://discord.com/api/webhooks/1556550787042250853/LY47iInn1h81PI4QtQOOLWVYxV4IRDPkBTUva2GRyqS7iYNfJj97fJhvwQAGJKFak5Bc";

  // Lấy ngày tháng năm hiện tại theo định dạng DD/MM/YYYY
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const dateStr = `${day}/${month}/${year}`;

  const embed = {
    title: "📊 BOOST SUMMARY",
    color: 0x2b2d31, // Màu tối giống trong ảnh
    fields: [
      {
        name: "BOOSTS",
        value: `**${boosts}**`,
        inline: true,
      },
      {
        name: "BOOSTED",
        value: `**${boosted}**`,
        inline: true,
      },
      {
        name: "EXISTING",
        value: `**${existing}**`,
        inline: true,
      },
      {
        name: "FAILED",
        value: `**${failed}**`,
        inline: true,
      },
    ],
    footer: {
      text: `Ngày: ${dateStr}  |  Server ID: ${serverId}`,
    },
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [embed],
      }),
    });

    if (!res.ok) {
      console.error("Gửi webhook thất bại:", await res.text());
    } else {
      console.log("Đã gửi lịch sử boost lên webhook thành công.");
    }
  } catch (error) {
    console.error("Lỗi khi gửi webhook:", error);
  }
}
