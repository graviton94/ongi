import 'chat_message.dart';

final _url = RegExp(r'https?://\S+|www\.\S+');
// 사진, 동영상 등 내용 없이 미디어만 있던 메시지.
final _mediaOnly = RegExp(
    r'^(사진|사진 \d+장|동영상|이모티콘|음성메시지|삭제된 메시지입니다\.|파일: .+|보이스톡.*|페이스톡.*|송금.*|지도: .+)$');
// 송금·선물 카드. 이런 줄이 들어 있으면 메시지 전체가 카드라서 그분의 말이 아니다.
final _cardLine = RegExp(
    r'^(송금 받기 전까지 보낸 분은 내역 상세화면에서 취소할 수 있어요\.|.+님이 선물을 보냈습니다!|\[[^\]]*선물[^\]]*\])$',
    multiLine: true);
// 퍼온 글(뉴스, 좋은 글, 광고)의 출처 표시. 그분이 쓴 글이 아니므로 버린다.
final _sourceLine = RegExp(r'^출처 ?:', multiLine: true);
// 자음·모음, 문장부호만 있는 단답 (ㅋㅋ, ㅎㅎ, ㅠㅠ, ㅇㅇ, ...).
final _filler = RegExp(r'^[ㄱ-ㆎ\s.,!?~^]+$');

/// 인격 추출에 쓸모없는 잡음을 걷어낸다.
///
/// URL은 지우고, 미디어 태그만 있거나 자음·모음 단답만 있는 메시지,
/// 송금·선물 카드, 출처가 붙은 퍼온 글은 버린다.
/// 지우고 나서 빈 메시지도 버린다.
List<ChatMessage> cleanMessages(Iterable<ChatMessage> messages) => [
      for (final m in messages)
        if (_keep(m.text)) m.copyWith(text: _strip(m.text)),
    ];

bool _keep(String text) {
  final stripped = _strip(text);
  return stripped.isNotEmpty &&
      !_mediaOnly.hasMatch(stripped) &&
      !_filler.hasMatch(stripped) &&
      !_cardLine.hasMatch(stripped) &&
      !_sourceLine.hasMatch(stripped);
}

// 줄 단위로 공백을 정리한다. 줄바꿈은 남겨야 카드·출처 줄을 줄 단위로 찾을 수 있다.
String _strip(String text) => text
    .replaceAll(_url, '')
    .split('\n')
    .map((line) => line.replaceAll(RegExp(r'[ \t]+'), ' ').trim())
    .where((line) => line.isNotEmpty)
    .join('\n');
