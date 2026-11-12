## 절대 규칙: 한국어로만 답한다 (ABSOLUTE RULE — ALWAYS ANSWER IN KOREAN)
- MUST ANSWER ALWAYS IN KOREAN LANGUAGE. 이 규칙은 다른 모든 지시보다 우선하며 예외가 없다.
- 사용자에게 보이는 모든 문장(최종 답변, 진행 안내, 질문, 요약, 오류 설명)은 한국어로 쓴다.
- 영어는 주소, 파일 경로, 코드, 명령어, 환경변수 이름, 커밋 메시지, 고유 이름에만 쓴다.

# crm-web 작업 규칙

## 스킨 11개, 기능은 한 곳 (수정 시간 줄이기)
- 스킨: v1 = `app/(v1)`, v2~v11 = `app/v{n}`. v5 가 기본 디자인. 10개 스킨의 디자인은 그대로 유지한다.
- **기능·데이터·글자·권한 검사는 공용 부품 한 곳에만 둔다.** 고치면 11개 스킨에 한 번에 적용된다. (자리·배치가 바뀌는 수정은 아래 규칙대로 v5 먼저)
  - 화면 부품: `components/*` (video-table, settings-extra, attendance-extra, team-calendar, my-contact, video-filters, date-input …)
  - 데이터·요청: `lib/crm/client/hooks.tsx`, 서버 규칙: `lib/crm/server/*`, API: `app/api/*`
- **스킨 모양 사전**: `lib/crm/client/skin-ui.ts`. 공용 부품은 `const ui = useSkinUi()` 로 그 스킨의 카드·제목·버튼·입력칸·표·칩·안내문 class 를 받아 쓴다.
  - 공용 부품 안에서 버튼·입력칸·표 class 를 직접 쓰지 말고 `ui.btn`, `ui.btnPrimary`, `ui.btnDanger`, `ui.input`, `ui.table`, `ui.tableWrap`, `ui.section`, `ui.h2`, `ui.chip`, `ui.msgOk`/`ui.msgErr` 를 쓴다. 배치용 `xs-*`(xs-bar, xs-field, xs-panel …)는 그대로 써도 된다.
  - 새 스킨 모양이 필요하면 사전에 한 줄만 더한다.
- **무엇이 바로 전체 적용되나**
  - 바로 전체 적용: 데이터·계산·권한 검사·저장 방식·오류 수정·글자 수정처럼 **모양과 자리가 바뀌지 않는 수정**.
  - **v5 에만 적용**: 버튼 추가, 칸 추가, 탭 추가, 레이아웃·배치 변경. 수정할 때는 v5 만 고친다.
    - 공용 부품 안에 새 버튼·칸을 넣어야 하면 `useSkinUi().key === 'v5'` 일 때만 보이게 막고, 그 줄에 `// v5전용: 0 때 해제` 를 단다.
- **사용자가 `0` 만 치면**: v5 에만 있는 버튼·칸·레이아웃 변경을 나머지 스킨에 적용한다.
  - `v5전용` 표시를 찾아 막아 둔 조건을 지우고, 각 스킨 페이지에 새 부품의 자리를 잡아 준다. 스킨 디자인은 바꾸지 않는다.

## 새 기능 = 설정에 보이기 권한도 함께
- 새 기능(메뉴)을 만들면 항상 설정 > 역할설정 표에 누구에게 보일지 켜기/끄기를 넣는다. `lib/crm/menus.ts` 의 `MENUS`·`MENU_KEYS` 에 한 줄 넣으면 11개 스킨 역할설정 표에 열이 생긴다.
- 페이지가 아직 v5 에만 있으면 `V5_ONLY_MENUS` 로 다른 스킨의 메뉴 줄만 막는다. 역할설정 표에서는 빼지 않는다.

## 배포
- `node scripts/prebuild-version.mjs` 로 버전을 올리고, 커밋·푸시 후 배포 사이트에서 버전을 확인한다. 답변 끝에 "버전 …" 을 쓴다.
- 비밀값(키·환경변수 값)은 출력하거나 깃허브에 올리지 않는다. 사용자가 실행할 SQL 은 답변 안에 ```sql 블록으로 통째로 붙인다.
