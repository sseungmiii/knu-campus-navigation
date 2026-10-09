# 크누패스 · 캠퍼스 도보 길찾기

카카오맵 JavaScript 지도와 공식 도보 REST API를 사용합니다. 장소 검색 → 출발·도착 선택 → 사이트 내부 경로 표시 → 선택 경로를 따라 움직이는 페이스메이커 순서입니다.

## 로컬 실행

Node.js 18 이상, 의존성 설치 없이 실행합니다.

1. `.env.example`을 `.env`로 복사하고 `KAKAO_REST_API_KEY`를 입력합니다. 이 파일은 Git에서 제외됩니다. 프론트엔드에는 REST 키를 넣지 않습니다.
2. Kakao Developers에서 공개 JavaScript 키의 SDK 도메인에 `http://127.0.0.1:5174`를 등록합니다.
3. `npm run dev`를 실행하고 http://127.0.0.1:5174/ 에 접속합니다.
4. 출발지·도착지를 검색 결과에서 선택하고 도보 경로 찾기를 누릅니다.
5. 경로 미리보기는 GPS 없이 12배속 재생합니다. 도보 안내 시작은 사용자 클릭 후 위치 권한을 요청하고 실제 시간·선택한 보행 속도로 목표 마커를 움직입니다. 안내 종료·경로 변경·페이지 종료 시 위치 추적을 정리합니다.

`npm run check`, `npm test`로 검증합니다. 서버는 127.0.0.1에만 바인딩하며 .env·server·tests·scripts를 정적 파일로 제공하지 않습니다. API 요청과 위치 좌표를 로그·저장소에 기록하지 않습니다.

## 경로 데이터

서버는 `GET https://dapi.kakao.com/v2/routing/walk`를 사용합니다. WGS84와 BROAD_FIRST·SHORTEST·ACCESSIBLE 옵션을 전달합니다. 응답의 route.legs[].steps[].path.points는 [경도, 위도] 순서이므로 지도 좌표 [위도, 경도]로 바꿉니다. 전체 예상 거리·시간과 단계 안내도 함께 표시합니다.

카카오가 제공한 경로선만 표시하며, 검색한 건물 중심 좌표까지 임의 직선을 잇지 않습니다. 검색 좌표와 보행 경로의 시작·끝이 30m 이상 떨어져 있거나 예상 거리와 좌표 길이가 15% 이상 차이나면 화면에 안내합니다. 페이스메이커는 제공된 경로선까지만 안내하며 건물 내부·층·구름다리의 접근성을 보장하지 않습니다. 실측 출입구·실내 연결 데이터는 다음 단계에서 보완합니다.

## 파일 구조

- index.html, src/styles.css: 겹치지 않는 길찾기 패널과 지도, 모바일 세로 배치
- src/app.js: 장소 선택·경로 요청·오류 처리·화면 동작
- src/map-service.js: 카카오 지도 표시, 연결 실패 시 기본 지도
- src/map-config.js: 공개 JavaScript 키와 공개 백엔드 URL 설정
- src/geo-utils.js, src/pacemaker.js: 미터 단위 보간·GPS 투영·페이스 비교
- server/routing.cjs: 서버에서만 사용하는 카카오 REST 연동
- scripts/dev-server.cjs: 같은 출처의 로컬 웹/API 서버
- src/campus-data.js, src/navigation.js, src/navigation-utils.js, src/route-utils.js: 이전 시연 자료. 새 화면에서는 로드하지 않습니다.

## 배포와 다음 단계

공개 주소는 https://knu-campus-navigation.vercel.app/ 입니다. Vercel 프로젝트를 이 저장소의 main에 연결하고 Production 환경변수 `KAKAO_REST_API_KEY`를 등록합니다. 카카오 JavaScript SDK 도메인에도 이 주소를 등록합니다. 환경변수 변경 후에는 재배포가 필요합니다.

`vercel.json`이 `npm run build`와 공개 출력 `dist`를 지정합니다. `api/route.js`, `api/search.js`는 서버 함수이며 REST 키는 서버 환경변수에서만 읽습니다. 빌드는 index.html·src·data만 복사하므로 .env·server·tests를 정적 파일로 공개하지 않습니다. API는 같은 Vercel 주소와 기존 https://sseungmiii.github.io/knu-campus-navigation/ 에서 이용할 수 있습니다. CORS는 두 출처만 허용합니다. 요청 제한은 함수 인스턴스별 임시 제한이며 분산된 전역 제한은 아닙니다.

JavaScript 키의 환경변수 관리는 이번 작업에 포함하지 않았습니다. 이 키는 브라우저에서 필요한 공개 키이며 SDK 도메인 제한을 유지합니다. REST 키는 공개 접두사나 브라우저 코드에 넣지 않습니다.

시간표 등록과 오늘 수업 자동 선택은 다음 단계이며 아직 구현하지 않았습니다. 요구사항은 docs/product-spec.md에 있습니다.

## 공식 문서

- https://developers.kakao.com/docs/ko/kakaomap/rest-api
- https://developers.kakao.com/docs/ko/getting-started/quota
- https://apis.map.kakao.com/web/documentation/
