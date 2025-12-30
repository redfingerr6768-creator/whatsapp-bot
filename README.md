# WhatsApp Bot Manager (GOWA Edition)

A complete WhatsApp automation system integrated with GOWA (Golang WhatsApp).

## 🚀 How to Run (Cara Menjalankan)

You need to run **two** separate components: the GOWA server (backend) and the Next.js app (frontend).

### 1. Start GOWA Server (Backend)
This handles the actual WhatsApp connection.

1. Open the project folder.
2. Double-click **`gowa-server\start-gowa.bat`**.
   - OR run via terminal: `.\gowa-server\start-gowa.bat`
3. A new window might open (or it runs in current terminal). Ensure it says it's running on port `3030`.

### 2. Start Application (Frontend)
This is the dashboard you see.

1. Open a new terminal in the project root (`c:\Users\Administrator\Downloads\PROJECT\ahhhh - Copy`).
2. Run:
   ```bash
   npm run dev
   ```
3. Open your browser to **[http://localhost:3000](http://localhost:3000)**.

### 3. Connect WhatsApp
1. On the dashboard (http://localhost:3000), if not connected, you will see a QR Code (or click "Connect" on Settings).
2. Scan the QR code with your WhatsApp mobile app (Linked Devices).

---

## ✨ Features
- **Dashboard**: Manage groups, contacts, and broadcasts.
- **Auto-Reply**: Configure keyword-based auto-replies.
- **AI Chat**: Integrated AI for smart responses.
- **Broadcast**: Send messages to multiple groups/contacts (supports media).
- **Bot Commands**:
  - `/tagall` (Admin): Tag all members.
  - `/toimg`: Convert sticker to image.
  - `/tomp3`: Convert video to audio.
  - `/ai <question>`: Ask AI.

## 🛠️ Troubleshooting
- **GOWA Error / Timeout**: Stop the GOWA server and run `start-gowa.bat` again.
- **QR Not Showing**: Ensure GOWA server is running on port 3030.
