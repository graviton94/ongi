import 'chat_message.dart';

/// 화자별 메시지 수. 많은 순으로 정렬한다.
List<MapEntry<String, int>> speakerCounts(Iterable<ChatMessage> messages) {
  final counts = <String, int>{};
  for (final m in messages) {
    counts[m.speaker] = (counts[m.speaker] ?? 0) + 1;
  }
  return counts.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
}

/// "소중한 분이 누구인가요?"를 물어야 하는지.
///
/// 앞부분 [sample]개 메시지에 화자가 2명 이상이면 사용자에게 고르게 한다.
/// 1:1 대화도 파일만으로는 어느 쪽이 업로더인지 알 수 없어 확인이 필요하다.
bool needsSpeakerSelection(List<ChatMessage> messages, {int sample = 50}) =>
    speakerCounts(messages.take(sample)).length >= 2;

/// 그리운 분의 말만 남긴다. 다른 사람의 메시지는 단말 밖으로 나가지 않는다(문서 06 D6).
List<ChatMessage> messagesOf(Iterable<ChatMessage> messages, String speaker) =>
    [
      for (final m in messages)
        if (m.speaker == speaker) m
    ];

/// 업로더가 이 대화의 참여자인지(문서 07 1.2). 참여자가 아니면 업로드를 보류한다.
bool isParticipant(Iterable<ChatMessage> messages, String uploaderName) =>
    messages.any((m) => m.speaker == uploaderName);
