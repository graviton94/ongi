/// 카카오톡 대화 내보내기 파일을 단말에서 파싱·정제한다.
///
/// 원문에는 다른 가족·지인의 메시지가 섞여 있으므로 이 패키지는 단말에서만 돌고,
/// 그리운 분의 말만 골라낸 결과만 다음 단계(기억 추출)로 넘긴다.
library;

export 'src/chat_message.dart';
export 'src/cleaner.dart';
export 'src/parser.dart';
export 'src/speakers.dart';
