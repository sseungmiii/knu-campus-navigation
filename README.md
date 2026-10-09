# 경북대학교 캠퍼스 내비게이션

서비스 기획 기준은 크누패스(KNU-Pass) 예선신청서입니다. 요구사항과 현재 구현 차이는 [서비스 요구사항](docs/product-spec.md), 수정 순서와 확인 기준은 [구현 계획](docs/implementation-plan.md)에 정리했습니다.

배포 사이트: https://sseungmiii.github.io/knu-campus-navigation/

GitHub Pages는 main 브랜치의 루트를 배포하도록 설정했습니다. main에 반영된 변경은 Pages 빌드 완료 후 사이트에 적용됩니다.

카카오지도 기반 캠퍼스 지도와 지름길 안내 시제품입니다. 인증 실패 시 Leaflet 기본 지도를 표시합니다. 경로 재생, 지도/위성 전환, 출발시간 역산, 식당·카페 정보 모달을 제공합니다.

## 개발 실행

Node.js 18 이상에서 의존성 설치 없이 실행할 수 있습니다.

```sh
npm run dev
```

http://127.0.0.1:5173 에 접속합니다. 파일 수정 후 브라우저를 새로고침하면 반영됩니다.

```sh
npm run check
npm test
npm run preview
```

preview는 http://127.0.0.1:4173 에서 실행합니다. Python을 사용하는 경우 `python -m http.server 5173`도 가능합니다.

## 프로젝트 구성

```text
index.html                화면과 스크립트 로딩 순서
src/styles.css            스타일
src/tailwind-config.js    Tailwind 테마
src/campus-data.js        캠퍼스 경계·건물·경로·POI 시연 데이터
src/route-utils.js        경로 보간 함수
src/app.js                지도와 화면 동작
src/map-config.js         공개 JavaScript 키
src/map-service.js        카카오지도·검색 및 기본 지도 대체
src/navigation.js         출발·도착 선택과 경로 안내
src/navigation-utils.js   그래프 최단 경로·거리·외부 길찾기 링크
scripts/                  개발 서버와 기본 검사
tests/                   경로 계산 검증
data/menu.sample.json    기존 학식 데이터 샘플 (현재 UI에서 미사용)
docs/development.md       다음 개발 작업 안내
AGENTS.md                 코드 작업 가이드
```

## 데이터와 지도

일반·위성 지도는 카카오지도입니다. 카카오 연결 실패 시 OpenStreetMap·Esri로 대체하며 실패 상태를 표시합니다. Leaflet 1.9.4, Tailwind CSS, Font Awesome을 CDN에서 불러옵니다. 인터넷 연결이 필요합니다.

메뉴·가격·혼잡도·교통 소요시간은 시연 데이터입니다. 등록된 5개 캠퍼스 노드에서 거리 기준 최단 경로와 건물 통로 제외 경로를 계산하고, 장소 검색 및 카카오맵 도보·대중교통 길찾기 링크를 제공합니다. 캠퍼스 경로는 기존 시연 좌표이며, 시간은 거리/분당 80m로 추정하고 층간·대기시간은 제외합니다. 실시간 교통·식단 API 연동은 아직 없습니다. 경계 좌표의 공식 출처와 실제 보행 가능 여부는 추가 검증이 필요합니다. 공개 JavaScript 키는 src/map-config.js에 있습니다. REST API/Admin 키는 넣지 않습니다. Kakao Developers에서 이 키의 SDK 도메인에 https://sseungmiii.github.io와 개발 주소 http://127.0.0.1:5173 또는 http://127.0.0.1:4173을 등록·저장하고 카카오맵 사용 설정을 확인하세요.

원본 단일 HTML 및 JSON은 로컬 상위 폴더의 .work/hackathon-original에 백업했습니다. 이 백업은 저장소에 업로드하지 않습니다.
