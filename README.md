# WORKS Markdown Preview

NAVER WORKS 웹 메시지와 `.md`/`.markdown` 첨부 파일을 원문 아래에서 안전하게 미리 보는 Chromium Manifest V3 확장 프로그램입니다. `mermaid` 코드 블록도 SVG 다이어그램으로 렌더링합니다.

## 기능

- Markdown 문법이 감지된 메시지 아래에 `프리뷰 보기` 버튼 표시
- 제목, 목록, 표, 인용문, 링크, 인라인 코드와 코드 블록 렌더링
- `.md`/`.markdown` 첨부 파일을 다운로드 없이 인라인 렌더링
- `mermaid` fenced code block을 strict 모드 SVG로 변환
- Mermaid 번들은 다이어그램 프리뷰를 처음 열 때만 로컬 확장 파일에서 지연 로드
- 만료 파일은 내용을 요청하기 전에 확인하여 프리뷰 버튼 비활성화
- WORKS 대화방 이동, 검색 결과, 새 메시지와 좌우 메시지 레이아웃 대응
- 원문, 반응, 컨텍스트 메뉴, 전달·저장 기능을 변경하지 않는 Shadow DOM UI

## 설치

```powershell
npm ci
npm run check
```

1. Chrome 또는 Brave에서 확장 프로그램 관리 페이지를 엽니다.
2. 개발자 모드를 켭니다.
3. `압축해제된 확장 프로그램을 로드합니다`를 선택합니다.
4. 이 저장소의 `dist` 폴더를 선택합니다.
5. `https://talk.worksmobile.com/`을 새로고침합니다.

확장 프로그램은 `talk.worksmobile.com`에서만 실행되며, 별도의 팝업이나 설정 권한을 요청하지 않습니다.

## 사용법

- Markdown 문법이 있는 메시지: 메시지 아래 `프리뷰 보기`를 누릅니다.
- Markdown 첨부 파일: 파일 카드 아래 `프리뷰 보기`를 누릅니다.
- 다시 누르면 프리뷰가 접힙니다.
- Mermaid는 다음처럼 fenced block으로 작성합니다.

````markdown
```mermaid
flowchart LR
    A[원문] --> B[Markdown]
    B --> C[안전한 프리뷰]
```
````

## 보안과 개인정보 보호

- 메시지와 파일 내용은 현재 WORKS 탭 안에서만 처리합니다.
- 파일은 WORKS가 사용하는 고정 저장소(`storage.worksmobile.com`)에서 현재 로그인 세션으로만 읽습니다.
- 내용, 파일 경로, 메시지 객체를 브라우저 저장소나 디스크에 기록하지 않습니다.
- 분석·텔레메트리·외부 렌더링 서버를 사용하지 않습니다.
- Markdown raw HTML은 비활성화하고 결과를 DOMPurify로 다시 정제합니다.
- Mermaid는 `securityLevel: "strict"`로 실행하며 클릭 지시와 HTML 실행을 허용하지 않습니다.
- 실행 코드는 확장 프로그램 패키지에 포함됩니다. CDN 스크립트를 사용하지 않습니다.

## 제한

- Chromium MV3 기반 Chrome과 Brave만 대상으로 합니다.
- 첨부 파일은 UTF-8 `.md`/`.markdown`, 최대 1 MiB만 지원합니다.
- 파일 보관 기간이 만료되었거나 WORKS 내부 구조가 변경되면 파일 프리뷰가 비활성화될 수 있습니다.
- Firefox, 모바일/데스크톱 네이티브 WORKS, Markdown 편집, 내보내기와 임의 `.txt` 프리뷰는 현재 범위가 아닙니다.

## 개발과 검증

```powershell
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
npm run verify:dist
npm run test:e2e
```

`verify:dist`는 Manifest V3 범위, 필수 산출물, 필수·선택 권한 부재, 원격 실행 코드, 위험한 동적 실행, 디버거·텔레메트리 패턴을 검사합니다. E2E는 실제 unpacked MV3 주입과 Mermaid 지연 로딩을 Chromium에서 확인합니다.

WORKS 셀렉터는 `src/content/selectors.ts`, 파일 메시지의 React 메타데이터 탐색은 `src/bridge/react-message.ts`에 모여 있습니다. WORKS 업데이트 후 버튼이 나타나지 않으면 두 파일과 `tests/fixtures/`의 관찰 구조를 함께 갱신합니다.
