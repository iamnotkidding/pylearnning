# 웹 페이지 키워드 필터링 툴

웹 페이지에서 특정 키워드나 정규식 패턴과 매칭되는 줄을 찾아주는 Python 툴입니다.

## 기능

- 여러 URL을 파일에서 로드하여 일괄 처리
- **HTML 태그 자동 제거** (`<div>`, `<span>`, `<p>` 등 모든 태그 제거)
- **`<br>` 태그를 개행으로 변환** (`<br>`, `<br/>`, `<br />` 모두 지원)
- HTML 엔티티 디코딩 (`&nbsp;`, `&lt;`, `&gt;` 등)
- 일반 텍스트 및 정규식 패턴 검색 지원
- 매칭된 줄 번호와 **전체 내용** 출력
- **pandas DataFrame을 이용한 CSV 저장** (Excel 호환)
- 텍스트 파일 및 CSV 파일 저장 가능
- 대소문자 구분 없는 검색

## 설치

```bash
pip install requests pandas
```

## 사용법

### 기본 사용 (콘솔 출력만)

```bash
python web_filter.py urls.txt keywords.txt
```

### 텍스트 파일로 저장

```bash
python web_filter.py urls.txt keywords.txt -o results.txt
```

### CSV 파일로 저장 (pandas DataFrame 사용)

```bash
python web_filter.py urls.txt keywords.txt -c results.csv
```

### 텍스트 파일과 CSV 파일 동시 저장

```bash
python web_filter.py urls.txt keywords.txt -o results.txt -c results.csv
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

## CSV 출력 형식

pandas DataFrame을 이용하여 다음과 같은 구조로 저장됩니다:

| URL | 줄번호 | 키워드 | 매칭내용 |
|-----|--------|--------|----------|
| http://example.com | 7 | Python | Welcome to Python Tutorial |
| http://example.com | 11 | version\s+\d+\.\d+ | Python version 3.12 is now available. |
| http://example.com | 19 | tutorial | Tutorial 2024 |

### CSV 파일 특징

- **UTF-8 BOM 인코딩** (`utf-8-sig`): Excel에서 한글이 깨지지 않음
- **pandas DataFrame 사용**: 데이터 분석 및 가공이 쉬움
- **헤더 포함**: URL, 줄번호, 키워드, 매칭내용
- **Excel 직접 열기 가능**: CSV를 Excel에서 바로 열어서 사용 가능

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

## HTML 처리

이 툴은 자동으로 다음과 같이 HTML을 처리합니다:

### 1. HTML 태그 제거
```html
<p>This is a <strong>test</strong></p>
```
→ `This is a test`

### 2. `<br>` 태그를 개행으로 변환
```html
Line 1<br>Line 2<br/>Line 3<br />Line 4
```
→
```
Line 1
Line 2
Line 3
Line 4
```

### 3. HTML 엔티티 디코딩
```html
&lt;div&gt; &amp; &nbsp; &quot;
```
→ `<div> &   "`

## 콘솔 출력 예제

```
================================================================================
검색 결과
================================================================================

📄 URL: http://example.com/page.html
   매칭 수: 3
--------------------------------------------------------------------------------
  줄     7 | 키워드: [Python]
  내용: Welcome to Python Tutorial

  줄    11 | 키워드: [version\s+\d+\.\d+]
  내용: Python version 3.12 is now available.

  줄    19 | 키워드: [tutorial]
  내용: Tutorial 2024

================================================================================
총 1개 URL에서 3개의 매칭을 발견했습니다.
================================================================================

✓ 결과가 'results.txt'에 저장되었습니다.

✓ CSV 결과가 'results.csv'에 저장되었습니다.
  총 3개의 매칭이 저장되었습니다.
```

## pandas로 CSV 데이터 분석

저장된 CSV 파일은 pandas로 쉽게 분석할 수 있습니다:

```python
import pandas as pd

# CSV 파일 읽기
df = pd.read_csv('results.csv')

# 기본 정보 확인
print(df.info())
print(df.head())

# URL별 매칭 수 확인
print(df['URL'].value_counts())

# 특정 키워드만 필터링
python_matches = df[df['키워드'] == 'Python']
print(python_matches)

# 줄 번호 기준으로 정렬
df_sorted = df.sort_values('줄번호')

# Excel 파일로 변환
df.to_excel('results.xlsx', index=False)
```

## 텍스트 파일 출력 형식 (results.txt)

```
웹 페이지 키워드 필터링 결과
================================================================================

URL: http://example.com/page.html
매칭 수: 3
--------------------------------------------------------------------------------
줄 7 | 키워드: Python
내용: Welcome to Python Tutorial

줄 11 | 키워드: version\s+\d+\.\d+
내용: Python version 3.12 is now available.

줄 19 | 키워드: tutorial
내용: Tutorial 2024
```

## 주요 특징

1. **자동 HTML 처리**: HTML 태그 제거 및 개행 변환
2. **pandas DataFrame 활용**: CSV 데이터를 쉽게 분석 가능
3. **Excel 호환**: UTF-8 BOM으로 한글 깨짐 방지
4. **다중 출력 형식**: 텍스트와 CSV 동시 저장 가능
5. **자동 인코딩 처리**: UTF-8로 파일을 읽고 씁니다
6. **오류 처리**: 잘못된 URL이나 정규식에 대한 경고 표시
7. **진행 상황 표시**: 처리 중인 URL과 매칭 수를 실시간으로 표시
8. **대소문자 무시**: 모든 검색은 대소문자를 구분하지 않습니다
9. **타임아웃 설정**: 10초 타임아웃으로 무한 대기 방지
10. **전체 줄 출력**: 매칭된 줄의 전체 내용을 출력

## 제한사항

- 각 줄에서 첫 번째 매칭만 기록됩니다
- 매우 큰 페이지의 경우 메모리 사용량이 증가할 수 있습니다

## 문제 해결

### 네트워크 오류
```
⚠️  URL 'https://example.com' 가져오기 실패: ...
```
- 인터넷 연결 확인
- URL이 올바른지 확인
- 방화벽 설정 확인

### 정규식 오류
```
⚠️  경고: 잘못된 정규식 '(unclosed': ...
```
- 정규식 문법 확인
- 이스케이프 문자 확인 (\를 \\로)

### pandas 설치 오류
```
pip install pandas
# 또는
pip install pandas --break-system-packages
```

## 라이선스

MIT License
