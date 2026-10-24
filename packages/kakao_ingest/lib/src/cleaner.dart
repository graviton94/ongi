import 'chat_message.dart';

final _url = RegExp(r'https?://\S+|www\.\S+');
// 사진, 동영상 등 내용 없이 미디어만 있던 메시지.
final _mediaOnly = RegExp(
    r'^(사진|사진 \d+장|동영상|이모티콘|음성메시지|삭제된 메시지입니다\.|파일: .+|보이스톡.*|페이스톡.*|송금.*|지도: .+)$');
// 자음·모음, 문장부호만 있는 단답 (ㅋㅋ, ㅎㅎ, ㅠㅠ, ㅇㅇ, ...).
final _filler = RegExp(r'^[ㄱ-ㆎ\s.,!?~^]+$');

/// 인격 추출에 쓸모없는 잡음을 걷어낸다.
///
/// URL은 지우고, 미디어 태그만 있거나 자음·모음 단답만 있는 메시지는 버린다.
/// 지우고 나서 빈 메시지도 버린다.
List<ChatMessage> cleanMessages(Iterable<ChatMessage> messages) => [
      for (final m in messages)
        if (_keep(m.text)) m.copyWith(text: _strip(m.text)),
    ];

bool _keep(String text) {
  final stripped = _strip(text);
  return stripped.isNotEmpty &&
      !_mediaOnly.hasMatch(stripped) &&
      !_filler.hasMatch(stripped);
}

String _strip(String text) =>
    text.replaceAll(_url, '').replaceAll(RegExp(r'[ \t]+'), ' ').trim();
