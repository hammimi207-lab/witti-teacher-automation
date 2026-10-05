# 기록요정 v1 / v2 배포 분리

2026-09-20 기준

| 버전 | URL | Vercel 프로젝트 | 로컬 위치 |
| --- | --- | --- | --- |
| v1 | https://girok-fairy.vercel.app | `girok-fairy` | `../versions/girok-fairy-v1/next-app/` |
| v2 | https://girok-fairy-v2.vercel.app | `girok-fairy-v2` | 현재 `next-app/` |

- v1은 배포 `dpl_Fv3hUQ2Vvq7Cjkw7GwetoGBGkz2T`로 고정했다. `kidbom.app`도 v1 프로젝트에 연결되어 있으나, 현재 DNS가 해석되지 않는다.
- 현재 폴더의 `.vercel/project.json`은 v2 프로젝트를 가리킨다. 이 폴더에서 `vercel deploy --prod`를 실행하면 v2 URL만 갱신된다.
- v2 배포에는 `NEXT_PUBLIC_APP_URL`, Supabase 공개 연결값, `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`를 등록했다. 서버 키는 사용자 승인 후 기존 Supabase에서 복사해 v2 Vercel의 Production Secret에만 저장했고, 배포 `AN5a7nprEfAPBrTLEczqaCQQfGK7`에 적용했다. SMTP 비밀번호와 관리자 인증 값은 복제되지 않았다. 신규 가입 이메일·관리자 기능은 이 값들을 설정하기 전까지 동작하지 않을 수 있다.
- v2의 예약 작업은 중복 실행을 막기 위해 `vercel.json`에서 제거했다.
- 사용자 결정에 따라 v1과 v2는 비용 추가 없이 기존 Supabase 프로젝트 `htbiyakelekprnuxucjc`를 공유한다. 따라서 데이터 이전 없이 기존 기록이 같은 DB에 유지된다. 한쪽에서 데이터를 수정·삭제하면 다른 쪽에도 반영된다.
- 2026-09-20 기록요정 테이블 CSV 8개와 Storage 파일 ZIP을 `../../backups/girok-fairy-2026-09-20/`에 백업했다. 사진 기록 40행과 사진 파일 40개 경로가 일치한다. 이 폴더는 `.gitignore`로 제외했다. Auth 사용자와 스키마는 별도 내보내기가 없으므로 전체 프로젝트 복원본은 아니다.
- v1을 휴면 상태로 해도 공유 Supabase의 DB·Storage 사용량은 줄지 않는다. v2 완료 후 용량을 줄이려면 보존 의무와 사용자 삭제 요청을 검토한 뒤 기록요정에서 더 이상 필요 없는 행과 Storage 파일을 선별 정리해야 한다. 다른 앱의 테이블과 버킷은 건드리지 않는다.

## 다음 작업

놀이 이야기 중심의 v2 구조를 현재 `next-app/`에서 수정하고 v2 프로젝트에 배포한다. v1은 보관본과 기존 프로젝트에서 유지한다.
