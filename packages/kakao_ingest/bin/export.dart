// 카톡 내보내기 파일에서 그리운 분의 말만 골라 엔진 입력 JSON으로 저장한다.
//
//   dart run kakao_ingest:export <대화.txt>...                     화자 목록 확인
//   dart run kakao_ingest:export <대화.txt>... --speaker 엄마 --me 나 --out loved_one.json
//   dart run kakao_ingest:export <대화.txt> --shape-report          파싱 실패 줄의 "모양"만 출력
//
// 파일을 여러 개 주면(1:1 대화 + 단체방) 그분의 말을 시간순으로 합친다.
// 그분과 본인의 이름은 파일마다 같아야 하고, 본인은 모든 대화의 참여자여야 한다.
//
// --shape-report는 글자를 가/A/9 같은 기호로 바꿔 내용 없이 줄 모양만 보여준다.
// 파서가 형식을 못 읽을 때 이 출력만 공유하면 대화 내용 노출 없이 패턴을 고칠 수 있다.
import 'dart:convert';
import 'dart:io';

import 'package:kakao_ingest/kakao_ingest.dart';

void main(List<String> args) {
  final files = args.takeWhile((a) => !a.startsWith('--')).toList();
  if (files.isEmpty) {
    stderr.writeln(
        '사용법: export <대화.txt>... [--speaker 이름 --me 내이름 --out 파일] [--shape-report]');
    exit(64);
  }

  final results = <String, ParseResult>{};
  for (final path in files) {
    final raw = File(path).readAsStringSync();
    final result = parseKakaoExport(raw);
    if (args.contains('--shape-report')) {
      stdout.writeln('== $path');
      _printShapeReport(raw, result);
      continue;
    }
    stdout.writeln('$path: 형식 ${result.format?.name ?? '알 수 없음'}, '
        '메시지 ${result.messages.length}개, 버린 줄 ${result.skippedLines}개');
    if (result.messages.isEmpty) {
      stderr.writeln('메시지를 찾지 못했습니다. --shape-report 결과를 확인하세요.');
      exit(1);
    }
    results[path] = result;
  }
  if (args.contains('--shape-report')) return;

  final speaker = _option(args, '--speaker');
  if (speaker == null) {
    for (final entry in results.entries) {
      stdout.writeln('${entry.key} 화자 (메시지 수):');
      for (final e in speakerCounts(entry.value.messages)) {
        stdout.writeln('  ${e.key} (${e.value})');
      }
    }
    stdout.writeln('--speaker 로 그리운 분을, --me 로 본인 이름을 지정하세요.');
    return;
  }

  final me = _option(args, '--me');
  for (final entry in results.entries) {
    if (me == null || !isParticipant(entry.value.messages, me)) {
      stderr.writeln('${entry.key}: 본인(--me)이 이 대화의 참여자가 아닙니다. '
          '본인이 참여한 대화만 쓸 수 있습니다.');
      exit(1);
    }
  }

  final cleaned = cleanMessages(mergeMessages(
      [for (final r in results.values) messagesOf(r.messages, speaker)]));
  if (cleaned.isEmpty) {
    stderr.writeln('"$speaker" 님의 메시지가 없습니다. --speaker 없이 실행해 화자 이름을 확인하세요.');
    exit(1);
  }
  final out = _option(args, '--out') ?? 'loved_one.json';
  File(out).writeAsStringSync(const JsonEncoder.withIndent('  ').convert({
    'speaker': speaker,
    'source': {for (final r in results.values) r.format!.name}.join(','),
    'messages': [
      for (final m in cleaned)
        {'time': m.time.toIso8601String(), 'text': m.text}
    ],
  }));
  stdout.writeln('$speaker 님의 메시지 ${cleaned.length}개를 $out 에 저장했습니다. '
      '(대화 ${results.length}개 합침, 다른 사람의 메시지는 저장하지 않음)');
}

String? _option(List<String> args, String name) {
  final i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}

void _printShapeReport(String raw, ParseResult result) {
  stdout.writeln('형식: ${result.format?.name ?? '알 수 없음'}, '
      '메시지 ${result.messages.length}개, 버린 줄 ${result.skippedLines}개');
  final lines = raw.replaceAll('\r\n', '\n').split('\n');
  stdout.writeln('앞 15줄의 모양:');
  for (final line in lines.take(15)) {
    stdout.writeln('  ${_shape(line)}');
  }
}

/// 내용을 지우고 구조만 남긴다. 숫자→9, 한글→가, 영문→A. 오전/오후·년월일·요일과 구분 기호는 남긴다.
String _shape(String line) {
  const keep = ['오전', '오후', '년', '월', '일', '요일', '님과 카카오톡 대화', '저장한 날짜'];
  final buffer = StringBuffer();
  var i = 0;
  outer:
  while (i < line.length) {
    for (final k in keep) {
      if (line.startsWith(k, i)) {
        buffer.write(k);
        i += k.length;
        continue outer;
      }
    }
    final c = line[i];
    if (RegExp(r'[0-9]').hasMatch(c)) {
      buffer.write('9');
    } else if (RegExp(r'[가-힣ㄱ-ㅎㅏ-ㅣ]').hasMatch(c)) {
      buffer.write('가');
    } else if (RegExp(r'[A-Za-z]').hasMatch(c)) {
      buffer.write('A');
    } else {
      buffer.write(c);
    }
    i++;
  }
  return buffer.toString();
}
