# 운영 앱 주소 변경: https://kidbom.app

확인일: 2026-09-19. 화면 브랜드명은 기존 그대로 유지한다. 외부 설정과 배포는 이번 작업에서 변경하지 않았다.

## 확인한 현재 상태

- 앱: `next-app/`의 Next.js 16.3.4. 루트 Python/Streamlit 앱은 별도 기존 구현이다.
- 기존 운영 주소: `https://girok-fairy.vercel.app`.
- `.vercel/project.json` 및 Vercel API 확인: 프로젝트 `girok-fairy`, ID `prj_FM7yJ3FQl9lR6BuoTZPLkOW6v8uE`, 팀 `team_1uK325FNrzfttm0uxmbElQUA`.
- 원격 framework: `nextjs`, Node `24.x`, rootDirectory/buildCommand/installCommand: null(기본값). 연결된 도메인은 기존 주소 하나이며 verified=true, redirect=null.
- Vercel에 앱 URL 환경변수는 없었다. 기존 Supabase/SMTP/관리자/API/cron 환경변수는 유지한다.
- `kidbom.app`: 이 프로젝트에 미등록. DNS A 조회에서 이름 없음, HTTPS 연결 실패. Vercel domain config의 misconfigured=true. 도메인 구매 여부·소유권·다른 계정 점유 여부는 확인되지 않았다.
- Vercel domain config가 반환한 권장값: A `76.76.21.21`, CNAME `cname.vercel-dns.com.`. 도메인을 실제 추가한 뒤 프로젝트 Domains 화면에 표시되는 값이 최종 기준이다.

## 코드/환경변수 변경

- `src/lib/site-url.ts`: `NEXT_PUBLIC_APP_URL`을 공통 절대 URL로 사용. 미설정 시 운영은 `https://kidbom.app`, 개발은 `http://localhost:3000`. 경로·인증정보가 포함된 값과 운영 HTTP를 거부한다.
- `src/app/api/auth/find-id/route.ts`: 아이디 안내 이메일의 기존 하드코딩 로그인 링크를 공통 URL의 `/login`으로 변경.
- `src/app/layout.tsx`: metadataBase 추가. `src/app/page.tsx`: 홈 canonical/Open Graph URL 추가. 다른 페이지를 모두 홈 canonical로 지정하지 않는다.
- `.env.example` 신규 생성, `.env.local`에 `NEXT_PUBLIC_APP_URL=https://kidbom.app` 추가. `.gitignore`에 예시 파일 예외 추가. 로컬에서 이메일 링크도 로컬로 보내려면 `.env.local` 값을 `http://localhost:3000`으로 설정한다.
- `.deploy-tools/check-login.cjs`: 진단 대상 기본값을 새 주소로 변경하고 `NEXT_PUBLIC_APP_URL`로 덮어쓸 수 있게 한다. 실제 계정/DB를 변경하는 이 진단 스크립트는 실행하지 않았다.
- `tests/find-id.test.mjs`, `tests/site-url.test.mjs`: 이메일 링크, URL 설정, 새/기존/로컬 도메인의 인증 콜백 성공·실패 및 외부 next URL 무시를 검증.
- `NEXT_PUBLIC_SITE_URL`, `SITE_URL`은 기존에 없으며 추가하지 않았다. `NEXT_PUBLIC_SUPABASE_URL`은 Supabase 서버 주소이므로 변경하지 않았다.
- 로그인 후 `/records` 또는 `/records/new`, 비밀번호 변경 후 `/login` 이동 및 API 호출은 상대 경로다. 콜백은 요청 origin을 유지한다. 동일 출처 검사는 유지하므로 새·기존 도메인 각각에서 동작하며, 도메인 사이의 교차 출처 요청을 허용하지 않는다.
- OAuth 로그인, manifest, sitemap, robots.txt, 별도 공유 URL 생성기는 없다. 외부 참고자료 링크와 Streamlit의 `https://witti.kr/` 안내 링크는 앱 주소가 아니므로 유지했다.
- 기존 주소는 호환성 테스트와 이 문서, Vercel 프로젝트 연결 정보에만 보존한다. 강제 리디렉션은 추가하지 않았다.

## 사용자가 직접 수행할 Vercel/도메인 작업

1. 도메인 업체의 도메인 관리에서 `kidbom.app` 소유권을 확인한다. 미보유 상태라면 등록 가능 여부를 확인하고 직접 등록한다. DNS 조회 실패만으로 등록 가능하다고 판단하면 안 된다.
2. Vercel → 프로젝트 `girok-fairy` → Settings → Domains → Add Domain에 `kidbom.app` 입력 → Production 연결. 기존 `girok-fairy.vercel.app`은 유지한다. www는 이번 변경의 필수 항목이 아니다.
3. 도메인 업체 → `kidbom.app` → DNS 관리/레코드 관리에서 다음을 설정한다(업체가 확인되지 않아 실제 메뉴 명칭은 다를 수 있다).
   - 유형: A, 호스트/이름: `@`(업체가 요구하면 빈 값), 값: Vercel Domains에 표시되는 apex IPv4. 조회 시 권장값은 `76.76.21.21`. TTL: 기본값/자동.
   - 기존 apex A/AAAA와 충돌하지 않도록 확인한다. 메일 MX/TXT 등 무관한 레코드는 유지한다.
   - Vercel이 소유권 TXT 검증을 요구하면 화면의 이름과 값을 그대로 추가한다. 검증 토큰은 아직 발급되지 않았으므로 임의 값을 입력하지 않는다.
4. Vercel → Settings → Environment Variables에서 `NEXT_PUBLIC_APP_URL` = `https://kidbom.app`, Environment = Production으로 추가한다. Preview/Development에는 자동 적용하지 않는다. 해당 환경에서 절대 링크 검증이 필요하면 그 환경의 접속 origin을 별도로 지정한다.
5. 새 코드를 Production으로 배포한다. 현재 rootDirectory는 null이므로 기존처럼 `next-app`을 프로젝트 루트로 배포한다. Git 저장소 루트를 바꾸거나 연결 방식을 바꾸는 작업은 별도로 확인해야 한다. 환경변수만 저장해도 기존 배포에는 적용되지 않으므로 재배포가 필요하다.
6. Domains에서 Valid Configuration 및 HTTPS 인증서 발급을 확인한 후 아래 인증 점검을 수행한다.

## 사용자가 직접 수행할 Supabase 작업

현재 Supabase 프로젝트 ref는 `htbiyakelekprnuxucjc`이다. 대시보드 설정은 읽거나 변경하지 않았으므로 현재 Site URL/허용 목록/메일 템플릿 값은 미확인이다.

코드에는 다른 서비스와 공유하는 Supabase 프로젝트라는 설명이 있다. **Site URL은 프로젝트 전체 설정**이므로 다른 서비스가 기본 Site URL을 사용하는지 먼저 확인한다. 영향이 있다면 서비스별 명시적 redirectTo 또는 프로젝트 분리 계획을 마련한 뒤 변경한다. 기존 Redirect URLs는 삭제하지 않는다.

- Supabase → 해당 프로젝트 → Authentication → URL Configuration → Site URL: `https://kidbom.app` (공유 서비스 영향 확인 후).
- 같은 화면 → Redirect URLs → Add URL: `https://kidbom.app/auth/recovery-callback?mode=password`.
- 기존 앱 주소에 대한 허용 URL과 개발용 허용 URL은 전환 검증 동안 보존한다. 임의의 운영 wildcard(`/**`)는 필요하지 않다.
- 회원가입은 `/signup` → `/api/auth/signup`에서 자체 SMTP로 6자리 인증번호를 보내고 같은 화면에서 확인하는 방식이다. Supabase 확인 링크나 `/auth/callback`을 사용하는 구현이 아니므로 가상의 회원가입 콜백을 등록할 필요가 없다.
- 비밀번호 재설정 UI: `/account-recovery?mode=password`. 구현된 콜백: `/auth/recovery-callback?mode=password` → 성공 시 `/account-recovery?mode=password&verified=1`.
- **비밀번호 재설정 메일의 send 동작은 변경 전부터 503으로 중단되어 있다.** URL Configuration 변경만으로 메일 발송이 활성화되지 않는다. 이번 주소 변경에서 공유 서비스 SMTP/템플릿을 바꾸거나 발송을 활성화하지 않았다.
- 추후 전용 재설정 메일을 구현할 때 redirectTo를 정확히 위 콜백으로 지정하고, Authentication → Email Templates의 Reset Password 및 SMTP 설정을 검토한다. 기존 템플릿의 하드코딩 앱 주소 여부도 확인한다. 현재 콜백은 `code` 교환 방식이며 token_hash 확인 방식은 구현되어 있지 않다. 템플릿 링크 형식을 임의로 바꾸지 않는다.
- OAuth 로그인 호출/공급자 구현은 없으므로 이번 코드 변경 대상이 아니다. 대시보드에서만 설정된 공급자가 있다면 별도로 확인한다. 공급자 쪽 Supabase callback 주소를 앱 도메인으로 일괄 치환하지 않는다.

## 검증과 전환 기준

- `npm run build`: 성공(TypeScript 포함).
- `node --test tests/*.test.mjs tests/*.test.cjs`: 98개 통과. 외부 SMTP·실제 계정을 쓰지 않는 로컬 회귀 테스트다.
- `npm run lint`: 성공. 새 테스트의 변수명 규칙 문제 수정 후 재검사.
- 새 도메인의 실제 배포/로그인/메일 도착 검증은 DNS와 외부 설정 완료 후 수행해야 한다. 현재 완료로 간주할 수 없다.
- 새 도메인에서 동의 → 가입 인증번호 발송/검증 → 가입 → 아이디/이메일 로그인 → 기록 접근 → 로그아웃 → 아이디 찾기 이메일의 `/login` 링크를 순서대로 확인한다. 이미 쓰던 주소에서도 로그인 가능 여부를 확인한다.
- 비밀번호 재설정은 전용 메일 발송 기능을 별도로 복구한 다음 동일 브라우저에서 메일 요청 → code 콜백 → 비밀번호 변경 → 새 비밀번호 로그인 및 만료 링크 오류를 확인한다.
- 쿠키와 로컬 저장소는 도메인별이므로 새 주소에서 다시 로그인해야 한다. 기존 동의 복원도 확인한다. 진행 중인 인증을 새 도메인으로 강제 이동시키면 PKCE 쿠키를 잃을 수 있다.
- **지금은 기존 주소 리디렉션을 설정하지 않는다.** 새 배포·인증·기존 공유 서비스 영향을 확인한 후 주소 통합을 위해 리디렉션을 권장한다. Vercel Settings → Domains에서 기존 도메인의 Redirect 대상으로 `kidbom.app`을 설정할지 결정한다. 경로와 쿼리 보존, 진행 중인 인증 링크 만료를 확인한 뒤 적용한다.
- 문제 발생 시 기존 주소로 계속 접속하고, 필요하면 Production `NEXT_PUBLIC_APP_URL`을 기존 origin으로 되돌려 재배포한다. Supabase 설정도 변경 전 값을 기록해 두어야 한다.

공식 참고: [Vercel 도메인 연결](https://vercel.com/docs/domains/working-with-domains/add-a-domain), [DNS 값 확인](https://vercel.com/docs/domains/troubleshooting), [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [Supabase 비밀번호 인증](https://supabase.com/docs/guides/auth/passwords).
