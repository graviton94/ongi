import 'chat_message.dart';

// 한국어 설정 기준. 실제 내보내기 파일로 검증하고, 다른 형식이 나오면 패턴을 추가한다.
//   Android: 2024년 5월 1일 오후 2:30, 엄마 : 밥 먹었니
//   iOS:     2024. 5. 1. 오후 2:30, 엄마 : 밥 먹었니
//   PC:      --------------- 2024년 5월 1일 수요일 ---------------
//            [엄마] [오후 2:30] 밥 먹었니
final _android = RegExp(
    r'^(\d{4})년 (\d{1,2})월 (\d{1,2})일 (오전|오후) (\d{1,2}):(\d{2}), (.+?) : (.*)$');
final _ios = RegExp(
    r'^(\d{4})\. (\d{1,2})\. (\d{1,2})\. (오전|오후) (\d{1,2}):(\d{2}), (.+?) : (.*)$');
final _pcDate = RegExp(r'^-+ (\d{4})년 (\d{1,2})월 (\d{1,2})일 .*-+$');
final _pcMessage = RegExp(r'^\[(.+?)\] \[(오전|오후) (\d{1,2}):(\d{2})\] (.*)$');

// 메시지가 아니지만 시각으로 시작하는 줄 (입장·퇴장 알림 등).
final _mobileTimestamp = RegExp(
    r'^(\d{4}년 \d{1,2}월 \d{1,2}일|\d{4}\. \d{1,2}\. \d{1,2}\.) (오전|오후) \d{1,2}:\d{2}');
// 모바일 날짜 구분선: 2024년 5월 1일 수요일
final _mobileDateLine = RegExp(r'^\d{4}년 \d{1,2}월 \d{1,2}일 [월화수목금토일]요일$');
// 시각 없이 한 줄로 끼어드는 시스템 알림. 앞 메시지에 이어 붙이지 않는다.
final _bareSystemLine = RegExp(r'^메시지가 삭제되었습니다\.$');

/// 카카오톡 대화 내보내기(.txt) 원문을 메시지 목록으로 바꾼다.
///
/// 여러 줄 메시지는 다음 메시지가 나올 때까지 이어 붙인다.
/// 첫 메시지 전의 머리말과 시스템 알림은 버린다.
ParseResult parseKakaoExport(String raw) {
  final messages = <ChatMessage>[];
  KakaoFormat? format;
  DateTime? pcDate;
  var skipped = 0;
  // 직전 메시지에 이어 붙일 수 있는지. 시스템 알림이나 날짜 구분선 뒤에는 이어 붙이지 않는다.
  var canContinue = false;

  final lines = raw.replaceAll('\r\n', '\n').replaceAll('﻿', '').split('\n');
  for (final line in lines) {
    final android = _android.firstMatch(line);
    final ios = android == null ? _ios.firstMatch(line) : null;
    final mobile = android ?? ios;
    if (mobile != null) {
      format ??= android != null ? KakaoFormat.android : KakaoFormat.ios;
      messages.add(ChatMessage(
        time: _time(mobile.group(1)!, mobile.group(2)!, mobile.group(3)!,
            mobile.group(4)!, mobile.group(5)!, mobile.group(6)!),
        speaker: mobile.group(7)!.trim(),
        text: mobile.group(8)!,
      ));
      canContinue = true;
      continue;
    }

    final pcDateMatch = _pcDate.firstMatch(line);
    if (pcDateMatch != null) {
      pcDate = DateTime(int.parse(pcDateMatch.group(1)!),
          int.parse(pcDateMatch.group(2)!), int.parse(pcDateMatch.group(3)!));
      skipped++;
      canContinue = false;
      continue;
    }

    final pc = pcDate == null ? null : _pcMessage.firstMatch(line);
    if (pc != null) {
      format ??= KakaoFormat.pc;
      messages.add(ChatMessage(
        time: _time('${pcDate!.year}', '${pcDate.month}', '${pcDate.day}',
            pc.group(2)!, pc.group(3)!, pc.group(4)!),
        speaker: pc.group(1)!.trim(),
        text: pc.group(5)!,
      ));
      canContinue = true;
      continue;
    }

    if (_mobileTimestamp.hasMatch(line) ||
        _mobileDateLine.hasMatch(line) ||
        _bareSystemLine.hasMatch(line)) {
      skipped++;
      canContinue = false;
      continue;
    }

    if (canContinue && messages.isNotEmpty) {
      final last = messages.removeLast();
      messages.add(last.copyWith(text: '${last.text}\n$line'));
      continue;
    }

    if (line.trim().isNotEmpty) skipped++;
  }

  return ParseResult(
    messages: [for (final m in messages) m.copyWith(text: m.text.trimRight())],
    format: format,
    skippedLines: skipped,
  );
}

DateTime _time(
    String y, String mo, String d, String meridiem, String h, String mi) {
  var hour = int.parse(h) % 12;
  if (meridiem == '오후') hour += 12;
  return DateTime(
      int.parse(y), int.parse(mo), int.parse(d), hour, int.parse(mi));
}
