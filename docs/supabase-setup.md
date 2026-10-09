# Supabase 시간표 연결

현재 구현은 Next.js + `@supabase/ssr`를 사용한다. 지도와 카카오 경로는 로그인 없이 이용 가능하며, 시간표 데이터는 허용된 두 Auth 사용자만 각자 본인 소유 행에 접근한다. Secret Key 또는 service-role 키는 사용하지 않는다.

## 환경변수

로컬 `.env.local` 및 Vercel Production에 다음 이름으로 등록한다. 로컬 파일은 Git에서 제외된다.

- `SUPABASE_URL`: 프로젝트 URL
- `SUPABASE_PUBLISHABLE_KEY`: `sb_publishable_`로 시작하는 공개 키
- `KAKAO_REST_API_KEY`: 기존 카카오 서버 키

`SUPABASE_JWKS_URL`은 필수가 아니다. Supabase SDK가 프로젝트 URL에서 JWKS를 찾아 서명을 검증한다. 이 구현은 사용자 지정 JWKS URL이나 Secret Key를 읽지 않는다. Next.js 서버가 URL과 Publishable Key만 명시적으로 브라우저 컴포넌트에 전달하므로 `NEXT_PUBLIC_` 변수명으로 바꿀 필요가 없다. 카카오 REST 키는 서버에서만 읽는다.

Vercel에서는 Next.js 프레임워크와 저장소 루트, `npm run build`를 사용한다. 이전에 대시보드에서 Output Directory를 `dist`로 강제한 경우 기본값으로 되돌린다. 환경변수 변경 후 재배포한다. 아직 DB를 구성하지 않았다면 사용자 시간표를 실제로 저장할 수 없다.

## DB 준비

1. Supabase SQL Editor에서 `supabase/migrations/202610100001_private_timetables.sql`을 실행한다. 또는 연결된 Supabase CLI로 `supabase db push`를 사용한다. 앱 코드가 관리자 권한으로 테이블을 자동 생성하지 않는다.
2. 화면만 검토할 때에는 여기서 멈춰도 된다. 허용 목록이 비어 있으므로 모든 사용자에게 데이터 접근을 거부한다.
3. 실제 저장 테스트가 필요할 때 Auth → Users에서 두 이메일/비밀번호 테스트 계정을 생성하고 로그인 가능한 확인 상태로 준비한다. 비밀번호를 코드나 GitHub에 기록하지 않는다.
4. `supabase/allow-two-users.sql.example`의 두 UUID를 해당 Auth 사용자 ID로 바꾼 후 SQL Editor에서 실행한다. UUID 두 개가 서로 달라야 하며 실제 Auth 사용자여야 한다. 예시의 플레이스홀더를 그대로 실행하면 실패한다.
5. 일반 회원가입은 앱에 없다. 테스트 서비스를 제한하려면 Supabase Auth 설정에서 새 사용자 가입도 끈다. 가입 허용 여부와 관계없이 RLS는 허용된 두 UUID만 받아들인다.

## 보안과 데이터 구조

- `private.schedule_users`: 슬롯 1·2만 허용되는 관리자 관리 목록. anon/authenticated 역할에는 스키마·테이블 접근 권한이 없다.
- `public.is_schedule_user()`: 입력 인수 없는 함수. 현재 검증된 JWT의 `auth.uid()`가 목록에 있는지만 반환한다. 고정된 빈 search_path를 사용하는 security-definer 함수다.
- `public.timetable_classes`: 수업명·학기·요일(월1…일7)·시작/종료 분·학기 날짜·강의 장소/좌표. 사용자별 RLS와 DB 제약조건을 적용한다.
- 읽기/쓰기/수정/삭제 모두 `owner_id = auth.uid()`와 허용 목록을 확인한다. 클라이언트가 보낸 owner_id는 API에서 받아들이지 않는다. 직접 DB 요청에도 같은 정책이 적용된다.
- 서버는 `getUser()`로 로그인 검증 후 DB 함수로 허용 목록을 확인한다. 클라이언트 화면의 로그인 상태만으로 권한을 결정하지 않는다.
- SSR Proxy는 `getClaims()`로 세션을 갱신한다. 시간표 API 응답은 `private, no-store`이며 인증된 응답을 공유 캐시에 저장하지 않는다. 쓰기는 같은 출처 요청만 허용한다.
- 허용 목록에서 사용자를 제거하면 기존 JWT가 남아 있어도 데이터 접근이 즉시 차단된다. 관리용 Secret Key가 필요하지 않은 구조다.

## 시간표 이용

상단의 로그인·시간표에서 로그인한 뒤 수업과 장소를 등록한다. 장소는 검색 결과에서 선택해야 하며 시각·요일·학기 기간을 검증한다. 등록한 수업을 수정/삭제할 수 있다. 한국 시간 기준 오늘의 진행 중/다음 수업을 상단에 표시한다. 수업으로 길찾기를 선택하면 해당 강의 장소가 지도의 도착지가 된다. 출발지가 이미 있으면 경로를 조회하고, 없으면 출발지 선택을 안내한다. GPS 권한은 기존 지도 버튼을 눌렀을 때만 요청한다.

## 검증

Node.js 22 이상에서 `npm ci`, `npm run check`, `npm test`, `npm run build`를 실행한다. RLS 테스트는 임시 로컬 PostgreSQL(PGlite)에서 실제 SQL 마이그레이션과 역할을 적용해 익명/제3 사용자/소유자 위조/타인 수정/권한 회수를 검증한다. 실제 프로젝트 데이터나 계정을 만들지 않는다.

`node scripts/check-supabase.cjs`는 Publishable Key만으로 Auth/JWKS 연결 및 익명 DB 접근 상태를 확인한다. 키나 응답 데이터를 출력하지 않는다. 두 계정의 실제 로그인·저장 검증은 DB 마이그레이션과 계정 지정 후 수행한다.

공식 문서: https://supabase.com/docs/guides/auth/server-side/creating-a-client , https://supabase.com/docs/guides/database/postgres/row-level-security
