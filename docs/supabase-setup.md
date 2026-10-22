# Supabase 회원가입과 개인 시간표

지도는 공개 기능이며 이메일 인증 회원은 본인 시간표만 이용한다. Secret/service-role 키는 사용하지 않는다.

## DB와 환경변수

로컬 Git 제외 파일 .env.local과 Vercel Production에 SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY를 등록한다. 기존 KAKAO_REST_API_KEY는 서버에서만 사용한다.

신규 DB는 202610100001_private_timetables.sql 다음 202610230001_verified_schedule_members.sql을 적용한다. 기존 DB에는 두 번째만 적용한다. 기존 수업과 옛 허용 목록은 삭제하지 않는다. 두 번째 마이그레이션은 2026-10-23 운영 DB에 적용했다. allow-two-users 예시는 이전 정책용이다.

## 인증 설정

- Email 가입 허용, 이메일 확인 활성화 유지.
- Site URL: https://knu-campus-navigation.vercel.app
- Redirect URL: https://knu-campus-navigation.vercel.app/auth/callback
- 로컬 개발은 정확한 개발 callback 주소를 별도 등록한다.
- 운영 메일에는 SMTP 제공자 설정과 실제 수신 확인이 필요하다. 코드 검사만으로 메일 발송 성공을 주장하지 않는다. 이메일 확인을 끄지 않는다.

가입 → 이메일 인증 → 로그인 후 개인 시간표를 이용한다. callback은 인증 코드를 세션으로 교환하고 홈으로 돌아온다. 같은 브라우저에서 링크를 여는 흐름이며 다른 브라우저에서 인증했다면 원래 화면에서 로그인한다. 재발송 버튼을 제공한다. 원문 인증 오류와 코드는 로그나 화면에 노출하지 않는다.

## 접근 제한

public.is_schedule_user()는 auth.uid()의 auth.users 행에서 이메일 확인과 차단 여부를 검사한다. 고정된 빈 search_path의 security-definer 함수이며 anon 실행은 금지한다. 모든 시간표 RLS는 owner_id = auth.uid()도 함께 확인한다. API는 getUser()로 검증하고 클라이언트 owner_id를 신뢰하지 않는다. 응답은 private, no-store이고 쓰기는 같은 출처만 허용한다.

이메일 확인 회수나 계정 차단은 기존 세션에서도 DB 접근을 차단한다. 롤백은 기본 마이그레이션의 eligibility 함수만 복원한다. 새 회원은 접근을 잃지만 수업 행은 삭제하지 않는다.

## 검증과 현재 범위

Node.js 22 이상에서 npm run check, npm test, npm run build를 실행한다. PGlite 테스트는 실제 SQL로 인증 회원 3명, 미인증·차단·익명, 타인 접근·소유자 위조, 기존 행 보존, 인증 회수를 확인한다. 가입 입력과 callback 성공/실패도 검사한다. 실제 회원이나 메일은 만들지 않는다. 운영 메일 수신부터 로그인·저장까지는 별도 확인이 필요하다.

수업 길찾기는 장소와 수업 시각을 지도에 전달한다. 출발지가 없으면 선택을 안내한다. 수업 클릭 시 자동 GPS 조회와 실내 경로는 이후 작업이다.

공식 문서: https://supabase.com/docs/reference/javascript/auth-signup , https://supabase.com/docs/guides/auth/server-side/creating-a-client , https://supabase.com/docs/guides/database/postgres/row-level-security
