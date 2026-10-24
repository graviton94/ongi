import 'package:kakao_ingest/kakao_ingest.dart';
import 'package:test/test.dart';

// 실제 내보내기 파일과 같은 모양으로 만든 가상 대화. 실제 가족 대화는 저장소에 넣지 않는다.
const android = '''
엄마 님과 카카오톡 대화
저장한 날짜 : 2024-05-02 21:00:00

2024년 5월 1일 수요일
2024년 5월 1일 오후 2:30, 엄마 : 밥은 먹었니
2024년 5월 1일 오후 2:31, 나 : 응 먹었어
2024년 5월 1일 오후 2:32, 엄마 : 다행이다
날씨 추우니까
옷 따뜻하게 입고 다녀
2024년 5월 1일 오후 2:33, 엄마 : 사진
2024년 5월 1일 오후 2:34, 나 : ㅋㅋㅋ
2024년 5월 1일 오후 2:35, 엄마 : 이거 봐라 https://example.com/news 재밌더라
2024년 5월 1일 오전 12:05, 엄마 : 늦었다 얼른 자라
''';

const ios = '''
2024년 5월 1일 수요일
2024. 5. 1. 오전 9:05, 아빠 : 출근 잘 했냐
2024. 5. 1. 오후 12:10, 나 : 네
2024. 5. 1. 오후 12:11, 아빠님이 나갔습니다.
''';

const pc = '''
가족방 6 님과 카카오톡 대화
저장한 날짜 : 2024-05-02 21:00:00

--------------- 2024년 5월 1일 수요일 ---------------
[할머니] [오후 3:00] 다들 잘 지내지
[삼촌] [오후 3:01] 네 어머니
[할머니] [오후 3:02] 주말에 올 거면
미리 말해라
--------------- 2024년 5월 2일 목요일 ---------------
[나] [오전 8:00] 이번 주말에 갈게요
''';

void main() {
  group('parseKakaoExport', () {
    test('Android: 머리말과 날짜 구분선을 버리고 여러 줄 메시지를 이어 붙인다', () {
      final result = parseKakaoExport(android);
      expect(result.format, KakaoFormat.android);
      expect(result.messages, hasLength(7));
      expect(result.messages[2].text, '다행이다\n날씨 추우니까\n옷 따뜻하게 입고 다녀');
      expect(result.messages.first.time, DateTime(2024, 5, 1, 14, 30));
    });

    test('오전 12시는 0시, 오후 12시는 12시로 바꾼다', () {
      expect(parseKakaoExport(android).messages.last.time,
          DateTime(2024, 5, 1, 0, 5));
      expect(
          parseKakaoExport(ios).messages[1].time, DateTime(2024, 5, 1, 12, 10));
    });

    test('iOS: 입장·퇴장 알림은 메시지가 아니다', () {
      final result = parseKakaoExport(ios);
      expect(result.format, KakaoFormat.ios);
      expect(result.messages.map((m) => m.speaker), ['아빠', '나']);
    });

    test('PC: 날짜 구분선의 날짜를 각 메시지에 붙인다', () {
      final result = parseKakaoExport(pc);
      expect(result.format, KakaoFormat.pc);
      expect(result.messages, hasLength(4));
      expect(result.messages[2].text, '주말에 올 거면\n미리 말해라');
      expect(result.messages.last.time, DateTime(2024, 5, 2, 8, 0));
    });

    test('CRLF 줄바꿈과 BOM을 처리한다', () {
      final result = parseKakaoExport('﻿${ios.replaceAll('\n', '\r\n')}');
      expect(result.messages, hasLength(2));
    });

    test('형식을 알 수 없으면 빈 결과를 돌려준다', () {
      final result = parseKakaoExport('그냥 메모장 파일입니다');
      expect(result.format, isNull);
      expect(result.messages, isEmpty);
    });
  });

  group('cleanMessages', () {
    test('미디어 태그와 자음 단답은 버리고 URL은 지운다', () {
      final cleaned = cleanMessages(parseKakaoExport(android).messages);
      final texts = cleaned.map((m) => m.text).toList();
      expect(texts, isNot(contains('사진')));
      expect(texts, isNot(contains('ㅋㅋㅋ')));
      expect(texts, contains('이거 봐라 재밌더라'));
    });
  });

  group('실제 내보내기에서 발견한 형식', () {
    // 2026-10 실제 Android 내보내기 검증에서 나온 패턴을 가상 문장으로 재현.
    const realShapes = '''
2026년 3월 5일 오전 9:10
2026년 3월 5일 오전 9:10, 엄마 : 오늘 병원 다녀왔다
메시지가 삭제되었습니다.
2026년 3월 5일 오전 9:12, 엄마 : [쿠팡 로켓 선물]
홍길동님이 선물을 보냈습니다!
2026년 3월 5일 오전 9:13, 엄마 : 
송금 받기 전까지 보낸 분은 내역 상세화면에서 취소할 수 있어요.
2026년 3월 5일 오전 9:14, 엄마 : 건강에 좋은 습관 열 가지
1. 물을 자주 마신다
출처 : 어느 블로그
2026년 3월 5일 오전 9:15, 엄마 : 밥 잘 챙겨 먹어라
''';

    test('시각만 있는 줄과 삭제 알림은 메시지에 붙지 않는다', () {
      final messages = parseKakaoExport(realShapes).messages;
      expect(messages.first.text, '오늘 병원 다녀왔다');
    });

    test('송금·선물 카드와 출처가 붙은 퍼온 글은 버린다', () {
      final cleaned = cleanMessages(parseKakaoExport(realShapes).messages);
      expect(cleaned.map((m) => m.text), ['오늘 병원 다녀왔다', '밥 잘 챙겨 먹어라']);
    });
  });

  group('speakers', () {
    test('단톡방에서 그리운 분의 말만 고른다', () {
      final messages = parseKakaoExport(pc).messages;
      expect(needsSpeakerSelection(messages), isTrue);
      expect(speakerCounts(messages).first.key, '할머니');
      expect(
          messagesOf(messages, '할머니').map((m) => m.speaker).toSet(), {'할머니'});
    });

    test('여러 대화를 합치면 시간순으로 정렬하고 중복을 없앤다', () {
      final a = parseKakaoExport(android).messages;
      final merged = mergeMessages([messagesOf(a, '엄마'), messagesOf(a, '엄마')]);
      expect(merged, hasLength(messagesOf(a, '엄마').length));
      expect(merged.first.time, DateTime(2024, 5, 1, 0, 5));
    });

    test('업로더가 대화에 없으면 참여자가 아니다', () {
      final messages = parseKakaoExport(pc).messages;
      expect(isParticipant(messages, '나'), isTrue);
      expect(isParticipant(messages, '고모'), isFalse);
    });
  });
}
