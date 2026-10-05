# 기록요정 v2: 녹음·영상 → 새 기록 연결

실제 사용하는 `next-app`에 반영한 패치다. 기존 4버튼 홈, 사진 선별, 내 기록, 계정 메뉴, 공지사항·관리자 경로를 재사용한다. Streamlit용 패치는 이 앱 실행에 사용되지 않는다.

## 사용 흐름

- 홈 → 관찰 녹음 → 기존 녹음 저장·전사 → 교사 수정 전사문 확인 → **이 관찰로 새 기록 만들기**.
- 같은 관찰 창 하단 → **촬영한 영상으로 관찰하기** → 파일 선택 → 전송 확인 → **영상 전사·상황 분석** → 놀이/활동/혼합/판단 어려움, 시간별 장면·표정·행동, 놀이 이야기 과정의 근거 확인 → 관찰문 수정 → **이 관찰로 새 기록 만들기**.
- 새 기록 화면에서 기존 임시 기록이 있으면 복원 여부를 먼저 선택한다. **현재 기록의 관찰 입력에 추가**를 누르면 기존 관찰에 검토문을 이어 붙인다. 다른 기본 정보는 유지되며 이전 생성 결과는 지워 새 관찰로 다시 생성할 수 있다. 같은 관찰문은 중복 추가하지 않는다.
- 기존 기본 정보·기록 유형·관찰 입력·AI 활용 확인·생성·저장 흐름을 그대로 사용한다. 사진은 기존 Next 앱 규칙을 따른다. 저장한 결과는 홈의 내 기록 보기에서 확인한다.

## 변경 파일

| 위치 | 역할 |
| --- | --- |
| `src/app/page.tsx`, `features/home/quick-action-grid.tsx` | 확인된 로그인 사용자 ID를 관찰 창에 전달. 기존 네 버튼 유지. |
| `features/home/observation-recorder.tsx` | 기존 전사·수정문에서 새 기록 연결 버튼, 영상 입력 추가. 기존 녹음 저장·놀이 연결 유지. |
| `features/home/video-observation.tsx`, `prepare-observation-video.ts` | 원본 영상 재생, 90초·3MB 검사, 최대 8개 시점의 480px JPEG 추출, 전사·분석 결과 검토. |
| `src/app/api/observations/video/route.ts` | 기존 키로 영상 음성 전사와 장면 분석. 로그인·동일 출처·전송 확인·용량·시간표·프레임 검사. 기존 proxy의 동의 정책 적용. |
| `features/records/video-observation-schema.ts` | 기존 `PLAY_STORY_DETAILS`의 관심의 시작 / 탐색과 반복 / 표현과 구성 / 관계와 상호작용 / 확장과 심화 기준 재사용. |
| `features/home/observation-handoff.ts`, `features/records/observation-import.tsx` | 사용자별·현재 탭별 연결 데이터. 30분 만료, 한 번 적용 후 삭제. 관찰문을 URL에 넣지 않으며 총 15,000자 제한. |
| `src/app/records/new/page.tsx`, `features/records/record-wizard.tsx` | 연결 토큰으로 검토문 불러오기, 기존 임시 기록과 충돌하지 않는 수동 추가. |

기존 `OPENAI_API_KEY`, `OPENAI_MODEL`을 재사용한다. 전사 모델 선택 설정은 `OPENAI_TRANSCRIPTION_MODEL`, 기본값은 `gpt-4o-mini-transcribe`다. 새 키·DB 마이그레이션·FFmpeg 서버 설치는 필요하지 않다.

원본 영상과 추출 장면은 분석 요청에만 사용하고 DB에 보관하지 않는다. 영상 분석 초안은 현재 창의 메모리에 있으며, 새 기록으로 연결한 검토문은 사용자별 sessionStorage에 최대 30분 보관한다. 이후 기존 작성 중 임시 저장과 최종 저장 정책을 따른다. 저장 전에는 새로고침으로 영상 분석 결과가 사라질 수 있다.

## 분석의 범위

영상 전체가 아니라 시간별 8개 표본 장면과 음성을 함께 읽는다. 중간 사건은 놓칠 수 있다. 표정은 시선·입 모양 등 관찰 가능한 특징으로 기술하며 감정·성격·의도·발달 수준을 확정하지 않는다. 단계는 놀이 이야기의 기록 구성 기준이다. 활동·판단 어려움에는 놀이 단계를 강제로 부여하지 않고 확인되지 않은 과정은 관찰 부족으로 제시한다.

MP4·WebM 중 브라우저에서 길이와 장면을 읽을 수 있는 90초·3MB 이하 영상만 지원한다. MOV/HEVC 등 지원되지 않는 코덱은 MP4로 변환해야 한다. 배포 요청 크기를 고려한 제한이다. 음성이 없거나 전사 API에서 읽을 수 없으면 장면만 분석했다는 안내를 표시한다. API 키·한도·네트워크 오류는 성공으로 표시하지 않는다.

## 검증

타입 검사와 Next 프로덕션 빌드 통과. 오프라인 API/연결 데이터 테스트 6개, 기존 녹음·놀이 연결 브라우저 테스트 1개, 390×844 모바일 화면에서 녹음 수정문·실제 합성 MP4의 장면 추출 → 분석 결과 검토 → 기존 관찰문에 추가하는 브라우저 테스트 1개 통과. 브라우저 테스트의 API 응답은 대역이며 실제 유료 AI 호출·운영 DB 저장·휴대폰 하드웨어 마이크 권한은 별도 검증한다.

```powershell
node --test tests/video-observation.test.cjs tests/transcription.test.cjs tests/observation-play-links.test.cjs
node --test tests/observation-play-browser.cjs
# 합성 MP4 또는 비식별 테스트 영상 경로를 설정하면 실제 프레임 추출도 검증
$env:TEST_VIDEO_PATH = 'C:/path/to/test.mp4'
node --test tests/observation-media-browser.cjs
npx tsc --noEmit
npm run build
```

## 배포 후 모바일 확인

1. iPhone Safari·Android Chrome의 HTTPS 주소에서 네 버튼·관찰 창·원본 재생·보조 메뉴를 확인한다.
2. 10~20초 녹음 → 전사 → 오인식 수정 → 새 기록 연결 → 관찰 입력 추가. 기존 입력이 유지되고 정확히 한 번 추가되는지 확인한다.
3. 15~30초·3MB 이하 MP4 → 전송 확인 → 전사·분석. 놀이/활동 분류 근거, 시간별 장면, 단계·관찰 부족 표시를 원본과 비교한다. 수정문을 새 기록에 연결하고 기존 방식으로 생성·저장한 뒤 내 기록에서 확인한다.
4. 무음 영상, 91초 영상, 3MB 초과 파일, 지원하지 않는 코덱, API 오류를 확인한다. 실패 시 이전 파일의 분석이 새 결과처럼 표시되지 않아야 한다.
5. 기존 작성 중 기록을 복원한 뒤 연결 관찰을 추가하고, 다른 계정에서는 그 연결 내용이 열리지 않는지 확인한다. 연결 적용 후 URL 토큰과 sessionStorage가 정리되는지 확인한다.

2026-10-03 운영 배포 완료. Vercel 프로젝트 `girok-fairy-v2`, 배포 ID `dpl_BEYeQZz1SGXhwaoApUQFgVeR1k7u`, 상태 `READY`.
운영 주소: https://girok-fairy-v2.vercel.app . 운영 빌드에서 발견한 작성폼 타입·알림장 컴포넌트 호출 불일치를 수정했으며, 재빌드와 추가 검증 13개가 통과했다.
