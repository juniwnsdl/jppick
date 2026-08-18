# 가나 학습

히라가나와 가타카나를 글자표로 살펴보고, 직접 쓰고, 스스로 평가하며 반복 학습하는 로컬 우선 웹 앱입니다.

## 로컬 실행

Node.js 20.9 이상과 pnpm이 필요합니다.

```bash
pnpm install
pnpm dev
```

개발 서버는 기본적으로 `http://localhost:3000`에서 열립니다. 프로덕션 빌드는 다음과 같이 확인합니다.

```bash
pnpm build
pnpm start
```

## 학습 기능

- 히라가나·가타카나 글자표와 기본, 탁음·반탁음, 요음, 작은 글자, 확장 가타카나 필터
- 글자별 읽기와 로마자, 로컬 획순 안내, 선택한 한 글자 바로 연습
- 글자를 보며 쓰는 `따라 쓰기`와 읽기 힌트로 떠올리는 `암기 테스트`
- 히라가나, 가타카나, 혼합 범위와 5·10·20문제 또는 무제한 연습
- 균등 랜덤, 덜 연습한 문자 우선, 어려운 문자 우선 출제
- 직접 그린 뒤 정답 오버레이와 획순을 비교하고 `잘 썼어요` 또는 `다시 연습`으로 자기 평가
- 중단한 연습 이어하기, 어려웠던 문자만 다시 하기, 누적 기록 확인과 확인 문구를 거치는 기록 삭제

## 데이터와 개인정보

학습 기록과 중단 세션은 현재 브라우저의 IndexedDB에만 저장됩니다. 결과 화면 전달에는 같은 탭의 sessionStorage를 사용하며, 원본 필기 획은 자기 평가 뒤 장기 저장하지 않습니다. 계정, 서버 전송, 클라우드 동기화 기능은 없습니다.

브라우저 데이터 또는 사이트 데이터를 지우면 저장된 학습 진도와 중단 기록도 함께 삭제되며 복구할 수 없습니다. IndexedDB를 사용할 수 없는 환경에서는 현재 실행 중인 메모리에만 기록되어 새로고침 뒤 유지되지 않을 수 있습니다.

## 브라우저 지원

릴리스 테스트는 데스크톱 Chromium, 320×568 모바일 Chromium, iPhone 13 크기의 WebKit에서 수행합니다. 현재 버전의 Chromium 계열 브라우저와 iPhone Safari/WebKit을 지원 대상으로 합니다. 자바스크립트, IndexedDB, Pointer Events, Canvas, ResizeObserver가 필요합니다.

## 검증 명령

```bash
pnpm validate:kana
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm test:e2e
```

`pnpm test:e2e`는 프로덕션 빌드를 실행한 뒤 데스크톱 Chromium, 320×568 Chromium, iPhone WebKit 프로젝트를 검사합니다. 처음 실행할 때 브라우저가 없다면 `pnpm exec playwright install chromium webkit`을 실행합니다.

## 획순 데이터 출처

획순 SVG는 런타임 CDN 요청 없이 `public/strokes/`에 포함되어 있습니다. 기본 출처는 [zhengkyl/strokesvg](https://github.com/zhengkyl/strokesvg)이며 Klee One 기반 SVG를 SIL Open Font License 1.1 조건으로 사용합니다. 전체 출처, 변환 내역, 라이선스 전문은 [`public/THIRD_PARTY_LICENSES.md`](public/THIRD_PARTY_LICENSES.md)에 있습니다.

요음과 확장음처럼 여러 글자로 이루어진 단위는 별도 복합 SVG 대신 각 기본 글자의 로컬 획순 자산을 쓰기 순서대로 나란히 표시합니다.
