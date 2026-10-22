# Supabase 회원가입과 개인 시간표

지도는 공개 기능이며 가입을 완료한 회원은 본인 시간표만 이용한다. Secret/service-role 키는 사용하지 않는다.

## DB와 환경변수

로컬 Git 제외 파일 .env.local과 Vercel Production에 SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY를 등록한다. 기존 KAKAO_REST_API_KEY는 서버에서만 사용한다.

신규 DB는 202610100001_private_timetables.sql 다음 202610230001_verified_schedule_members.sql을 적용한다. 기존 DB에는 두 번째만 적용한다. 기존 수업과 옛 허용 목록은 삭제하지 않는다. 두 번째 마이그레이션은 2026-10-23 운영 DB에 적용했다. allow-two-users 예시는 이전 정책용이다.

수업별 즐겨찾기를 위해 20261022155625_class_route_favorites.sql도 적용한다. 기존 RLS를 그대로 사용하는 nullable 열이며 기존 수업은 보존한다. CLI가 생성한 UTC 시각을 파일명에 사용한다. 주간 시간표와 즐겨찾기 동작은 docs/timetable-calendar.md를 참고한다.

## 인증 설정

- Email 제공자를 통한 비밀번호 가입 허용, Confirm email 비활성화. 사용자가 요청한 아이디 즉시 가입 정책이다.
- Site URL: https://knu-campus-navigation.vercel.app
- Redirect URL: https://knu-campus-navigation.vercel.app/auth/callback
- 로컬 개발은 정확한 개발 callback 주소를 별도 등록한다.
- SMTP는 현재 가입에 필요하지 않다. 아이디는 내부적으로 accounts.knupass.invalid 주소에 대응하며 메일은 발송하지 않는다. 비밀번호 복구 메일 기능은 제공하지 않는다.

아이디(영문·숫자·_·- 3~24자, 소문자 정규화)와 비밀번호(8자 이상), 비밀번호 확인을 입력하면 가입 후 자동 로그인한다. 기존 이메일 계정은 이메일로 로그인할 수 있다. 이메일 확인 상태는 Supabase가 가입 시 자동 설정하며 실제 메일 소유 검증을 의미하지 않는다. 이전 인증 callback은 기존 링크 호환용으로 유지한다.

## 접근 제한

public.is_schedule_user()는 auth.uid()의 auth.users 행에서 이메일 확인과 차단 여부를 검사한다. 고정된 빈 search_path의 security-definer 함수이며 anon 실행은 금지한다. 모든 시간표 RLS는 owner_id = auth.uid()도 함께 확인한다. API는 getUser()로 검증하고 클라이언트 owner_id를 신뢰하지 않는다. 응답은 private, no-store이고 쓰기는 같은 출처만 허용한다.

Auth 확인 상태 회수나 계정 차단은 기존 세션에서도 DB 접근을 차단한다. 롤백은 기본 마이그레이션의 eligibility 함수만 복원한다. 새 회원은 접근을 잃지만 수업 행은 삭제하지 않는다.

## 검증과 현재 범위

Node.js 22 이상에서 npm run check, npm test, npm run build를 실행한다. PGlite 테스트는 실제 SQL로 인증 회원 3명, 미인증·차단·익명, 타인 접근·소유자 위조, 기존 행 보존, 인증 회수를 확인한다. 가입 입력과 callback 성공/실패도 검사한다. 실제 회원이나 메일은 만들지 않는다. 신규 가입·재로그인·본인 시간표 조회는 운영 공개 키로 별도 확인한다.

수업 길찾기는 장소와 수업 시각을 지도에 전달한다. 출발지가 없으면 선택을 안내한다. 수업 클릭 시 자동 GPS 조회와 실내 경로는 이후 작업이다.

공식 문서: https://supabase.com/docs/reference/javascript/auth-signup , https://supabase.com/docs/guides/auth/server-side/creating-a-client , https://supabase.com/docs/guides/database/postgres/row-level-security
