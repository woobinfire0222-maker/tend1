# TEND — Discord 서버 관리 콘솔

GitHub Pages에서 호스팅하는 React/Vite 정적 사이트입니다. 로그인, 사용자 권한, 채팅 기록과 서비스 데이터는 Supabase를 사용합니다. Discord 서버에 실제 조치를 수행하는 기능은 별도 Discord 봇이 Supabase와 연동되어 있어야 작동합니다.

## 1. 로컬 실행

필요 환경: Node.js 22 이상, npm

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local`에 실제 Supabase URL과 publishable/anon key를 입력합니다. 비밀키(`service_role`, Discord bot token, OAuth client secret)는 절대 프론트엔드 환경 변수에 넣지 마세요.

## 2. Supabase 준비

1. Supabase 프로젝트를 만듭니다.
2. `supabase/migrations/001_initial_schema.sql`을 SQL Editor에서 실행합니다.
3. Authentication → Providers에서 Discord를 활성화합니다.
4. Discord Developer Portal의 OAuth2 Redirect URL과 Supabase Authentication URL 설정을 일치시킵니다. Supabase Discord provider 설정에 필요한 Client ID/Secret은 Supabase 대시보드에만 입력합니다.
5. Authentication → URL Configuration에 로컬 주소와 GitHub Pages 배포 주소를 등록합니다.
6. Storage 정책과 채팅 첨부 파일 버킷은 마이그레이션에 포함된 정책을 확인하고, 버킷이 생성되었는지 확인합니다.

오너 계정은 Discord 사용자명만으로 확인하지 않습니다. 실제 Discord 숫자 사용자 ID를 확인한 후 Supabase Edge Function 환경 변수 `TEND_OWNER_DISCORD_ID`에 설정해야 합니다. Supabase CLI로 `supabase functions deploy owner-bootstrap` 및 `supabase functions deploy owner-admin`을 실행하고, `supabase secrets set TEND_OWNER_DISCORD_ID=실제_숫자_ID`로 설정하세요. Supabase의 `SUPABASE_URL` 및 `SUPABASE_SERVICE_ROLE_KEY`는 함수 실행 환경에서만 사용해야 하며 저장소에 커밋하지 마세요.

## 3. GitHub Pages 배포

1. 이 폴더의 내용을 GitHub 저장소 루트에 업로드합니다.
2. 저장소 Settings → Secrets and variables → Actions → Variables에서 다음 변수를 추가합니다.
   - `VITE_SUPABASE_URL`: Supabase 프로젝트 URL
   - `VITE_SUPABASE_ANON_KEY`: Supabase publishable/anon key
3. `main` 브랜치에 push합니다. `.github/workflows/deploy.yml`이 빌드 후 GitHub Pages로 배포합니다.
4. Settings → Pages에서 Source가 GitHub Actions인지 확인합니다.
5. GitHub Pages 주소를 Supabase Auth의 허용 URL 및 Discord OAuth 설정에 추가합니다.

프로젝트 사이트(`https://사용자.github.io/저장소명/`) 기준으로 빌드하도록 워크플로가 저장소 이름을 `VITE_BASE_PATH`에 지정합니다. 커스텀 도메인을 사용할 경우 워크플로의 `VITE_BASE_PATH`를 `/`로 바꾸고 `vite.config.ts`에서 기본 경로도 맞추세요.

## 4. 빌드 및 점검

```bash
npm run typecheck
npm run build
npm run preview
```

`dist/`가 정적 배포 결과물입니다. `404.html` fallback은 GitHub Pages에서 직접 URL을 열거나 새로고침할 때 SPA 라우팅이 깨지는 문제를 줄입니다.

## 5. 알려진 통합 전제

- 이 프로젝트는 정적 웹사이트입니다. Discord 봇을 실행하거나 서버에 직접 가입시킬 수 없습니다.
- 서버 관리 시작/중지, 실제 모더레이션 적용, Discord 공지 발송은 별도 봇과 서버 측 작업이 구성되어 있어야 실제 동작합니다.
- 수동 결제 확인은 결제사 자동 결제와 다릅니다. 결제 제공자 연동이 없으면 자동 결제/환불을 완료했다고 표시하지 않습니다.
- Supabase 프로젝트별 RLS, Edge Function 배포, Discord OAuth, GitHub Pages 변수 설정 없이는 실서비스 로그인 및 관리자 기능을 검증할 수 없습니다.
- 사이트에 있는 기능 중 외부 서비스가 필요한 기능은 연결 상태와 오류를 확인한 후 사용하세요. 설정되지 않은 연동을 성공한 것처럼 표시하지 않습니다.
