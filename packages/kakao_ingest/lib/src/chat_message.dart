/// 카카오톡 내보내기 파일에서 읽어낸 메시지 한 건.
class ChatMessage {
  const ChatMessage({
    required this.time,
    required this.speaker,
    required this.text,
  });

  final DateTime time;
  final String speaker;
  final String text;

  ChatMessage copyWith({String? text}) =>
      ChatMessage(time: time, speaker: speaker, text: text ?? this.text);

  Map<String, Object> toJson() => {
        'time': time.toIso8601String(),
        'speaker': speaker,
        'text': text,
      };

  @override
  String toString() => '[$time] $speaker: $text';
}

/// 내보내기 파일이 만들어진 환경. 형식마다 줄 모양이 다르다.
enum KakaoFormat { android, ios, pc }

class ParseResult {
  const ParseResult({
    required this.messages,
    required this.format,
    required this.skippedLines,
  });

  final List<ChatMessage> messages;

  /// 메시지를 하나도 찾지 못했으면 null.
  final KakaoFormat? format;

  /// 머리말, 날짜 구분선, 입장·퇴장 같은 시스템 알림처럼 버린 줄 수.
  final int skippedLines;
}
