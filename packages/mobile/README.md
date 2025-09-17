# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/d1acdfe6-ba29-4a8f-95a9-505b7e0821fa

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/d1acdfe6-ba29-4a8f-95a9-505b7e0821fa) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- WebSocket (실시간 프린터 데이터 통신)

## 웹소켓 설정

이 프로젝트는 웹소켓을 통해 프린터와 실시간 통신합니다.

### 환경변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음을 추가하세요:

```bash
# 웹소켓 서버 URL
VITE_WEBSOCKET_URL=ws://localhost:8080

# Supabase 설정
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 웹소켓 메시지 형식

클라이언트에서 서버로 전송하는 메시지 형식:

```typescript
// 프린터 상태 전송
wsClient.send('printer_status', {
  status: 'printing',
  connected: true,
  printing: true,
  error_message: null
});

// 온도 정보 전송
wsClient.send('temperature_update', {
  tool: { current: 195.5, target: 200 },
  bed: { current: 60.2, target: 60 }
});

// 위치 정보 전송
wsClient.send('position_update', {
  x: 120.5,
  y: 80.2,
  z: 0.3,
  e: 45.7
});

// 프린트 진행상황 전송
wsClient.send('print_progress', {
  completion: 0.45,
  file_position: 1024,
  file_size: 2048,
  print_time: 1800,
  print_time_left: 2200,
  filament_used: 150.5
});
```

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/d1acdfe6-ba29-4a8f-95a9-505b7e0821fa) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
