# 웹 페이지 키워드 필터링 툴

웹 페이지에서 특정 키워드나 정규식 패턴과 매칭되는 줄을 찾아주는 Python 툴입니다.

## 기능

- 여러 URL을 파일에서 로드하여 일괄 처리
- 일반 텍스트 및 정규식 패턴 검색 지원
- 매칭된 줄 번호와 내용 출력
- 결과를 파일로 저장 가능
- 대소문자 구분 없는 검색

## 설치

```bash
pip install requests
```

## 사용법

### 기본 사용

```bash
python web_filter.py urls.txt keywords.txt
```

### 결과를 파일로 저장

```bash
python web_filter.py urls.txt keywords.txt -o results.txt
```

### 도움말 보기

```bash
python web_filter.py -h
```

## 파일 형식

### urls.txt (URL 목록)

```
# 주석은 '#'로 시작합니다
https://example.com
https://www.python.org
https://docs.python.org/3/
```

- 한 줄에 하나의 URL
- '#'로 시작하는 줄은 무시됨
- 빈 줄은 무시됨

### keywords.txt (키워드 목록)

```
# 일반 텍스트 검색
Python
tutorial
documentation

# 정규식 패턴 (<<REGEX>> 접두사 사용)
<<REGEX>>version\s+\d+\.\d+
<<REGEX>>\d{3}-\d{4}
<<REGEX>>error|warning
```

- 한 줄에 하나의 키워드
- 일반 텍스트: 그대로 입력
- 정규식: 맨 앞에 `<<REGEX>>` 추가
- '#'로 시작하는 줄은 무시됨

## 정규식 예제

```
# 숫자 패턴
<<REGEX>>\d{3}-\d{4}          # 전화번호 형식 (123-4567)
<<REGEX>>\d+\.\d+\.\d+        # 버전 번호 (1.2.3)

# 날짜 패턴
<<REGEX>>\d{4}-\d{2}-\d{2}    # ISO 날짜 (2024-01-10)

# 단어 패턴
<<REGEX>>Python\s+\d+         # Python 다음에 숫자
<<REGEX>>error|warning        # error 또는 warning

# 이메일 패턴
<<REGEX>>\w+@\w+\.\w+         # 간단한 이메일
```

## 출력 예제

```
================================================================================
검색 결과
================================================================================

📄 URL: https://www.python.org
   매칭 수: 5
--------------------------------------------------------------------------------
    42 | [Python]                            | <title>Welcome to Python.org</title>
   123 | [version 3.12]                      | The current stable version is Python 3.12
   456 | [tutorial]                          | Check out our beginner's tutorial
   
📄 URL: https://docs.python.org/3/
   매칭 수: 3
--------------------------------------------------------------------------------
    15 | [documentation]                     | Python 3.12 Documentation
    89 | [Python 3]                          | This is the official Python 3 documentation

================================================================================
총 2개 URL에서 8개의 매칭을 발견했습니다.
================================================================================
```

## 주요 특징

1. **자동 인코딩 처리**: UTF-8로 파일을 읽고 씁니다
2. **오류 처리**: 잘못된 URL이나 정규식에 대한 경고 표시
3. **진행 상황 표시**: 처리 중인 URL과 매칭 수를 실시간으로 표시
4. **대소문자 무시**: 모든 검색은 대소문자를 구분하지 않습니다
5. **타임아웃 설정**: 10초 타임아웃으로 무한 대기 방지

## 라이선스

MIT License
