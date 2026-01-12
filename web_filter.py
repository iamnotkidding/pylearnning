#!/usr/bin/env python3
"""
웹 페이지 키워드 필터링 툴
URL 목록과 키워드 목록을 파일에서 읽어와서 매칭되는 줄을 출력합니다.
"""

import re
import sys
import argparse
import requests
import pandas as pd
from typing import List, Tuple
from urllib.parse import urlparse
from html import unescape


class WebLineFilter:
    def __init__(self, urls_file: str, keywords_file: str):
        """
        초기화
        
        Args:
            urls_file: URL 목록이 저장된 파일 경로
            keywords_file: 키워드 목록이 저장된 파일 경로
        """
        self.urls = self._load_urls(urls_file)
        self.keywords = self._load_keywords(keywords_file)
        
    def _load_urls(self, filepath: str) -> List[str]:
        """URL 파일에서 URL 목록 로드"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                urls = [line.strip() for line in f if line.strip() and not line.strip().startswith('#')]
            print(f"✓ {len(urls)}개의 URL을 로드했습니다.")
            return urls
        except FileNotFoundError:
            print(f"❌ 오류: '{filepath}' 파일을 찾을 수 없습니다.")
            sys.exit(1)
        except Exception as e:
            print(f"❌ URL 파일 읽기 오류: {e}")
            sys.exit(1)
    
    def _load_keywords(self, filepath: str) -> List[Tuple[str, bool, re.Pattern]]:
        """
        키워드 파일에서 키워드 로드
        
        Returns:
            List of (원본 키워드, 정규식 여부, 패턴) 튜플
        """
        try:
            keywords = []
            with open(filepath, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue
                    
                    # 정규식 패턴 확인
                    if line.startswith('<<REGEX>>'):
                        regex_pattern = line[9:].strip()
                        try:
                            compiled_pattern = re.compile(regex_pattern, re.IGNORECASE)
                            keywords.append((regex_pattern, True, compiled_pattern))
                        except re.error as e:
                            print(f"⚠️  경고: 잘못된 정규식 '{regex_pattern}': {e}")
                            continue
                    else:
                        # 일반 문자열 검색 (대소문자 무시)
                        pattern = re.compile(re.escape(line), re.IGNORECASE)
                        keywords.append((line, False, pattern))
            
            print(f"✓ {len(keywords)}개의 키워드를 로드했습니다.")
            return keywords
        except FileNotFoundError:
            print(f"❌ 오류: '{filepath}' 파일을 찾을 수 없습니다.")
            sys.exit(1)
        except Exception as e:
            print(f"❌ 키워드 파일 읽기 오류: {e}")
            sys.exit(1)
    
    def _clean_html(self, text: str) -> str:
        """
        HTML 태그를 제거하고 <br> 태그를 개행으로 변환
        
        Args:
            text: 원본 HTML 텍스트
            
        Returns:
            정리된 텍스트
        """
        # <br>, <br/>, <br /> 태그를 개행으로 변환 (대소문자 무시)
        text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
        
        # 모든 HTML 태그 제거
        text = re.sub(r'<[^>]+>', '', text)
        
        # HTML 엔티티 디코딩 (&nbsp;, &lt; 등)
        text = unescape(text)
        
        return text
    
    def _fetch_webpage(self, url: str) -> Tuple[str, List[str]]:
        """
        웹 페이지를 가져와서 HTML 태그를 제거하고 줄 단위로 분리
        
        Returns:
            (URL, 줄 목록) 튜플
        """
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            # HTML 태그 제거 및 <br> 태그를 개행으로 변환
            cleaned_text = self._clean_html(response.text)
            
            # 텍스트를 줄 단위로 분리
            lines = cleaned_text.split('\n')
            return url, lines
        except requests.exceptions.RequestException as e:
            print(f"⚠️  URL '{url}' 가져오기 실패: {e}")
            return url, []
    
    def _search_lines(self, url: str, lines: List[str]) -> List[Tuple[int, str, str]]:
        """
        줄에서 키워드 검색
        
        Returns:
            List of (줄 번호, 매칭된 키워드, 줄 내용) 튜플
        """
        matches = []
        for line_num, line in enumerate(lines, 1):
            line_stripped = line.strip()
            if not line_stripped:
                continue
            
            for keyword, is_regex, pattern in self.keywords:
                if pattern.search(line):
                    matches.append((line_num, keyword, line_stripped))
                    break  # 하나의 줄에 대해 첫 번째 매칭만 기록
        
        return matches
    
    def run(self, output_file: str = None, csv_file: str = None):
        """
        메인 실행 함수
        
        Args:
            output_file: 결과를 저장할 텍스트 파일 경로 (선택사항)
            csv_file: 결과를 저장할 CSV 파일 경로 (선택사항)
        """
        print("\n" + "=" * 80)
        print("웹 페이지 키워드 필터링 시작")
        print("=" * 80 + "\n")
        
        all_results = []
        
        for idx, url in enumerate(self.urls, 1):
            print(f"[{idx}/{len(self.urls)}] 처리 중: {url}")
            
            url, lines = self._fetch_webpage(url)
            if not lines:
                continue
            
            matches = self._search_lines(url, lines)
            
            if matches:
                print(f"  ✓ {len(matches)}개의 매칭 발견\n")
                all_results.append((url, matches))
            else:
                print(f"  - 매칭 없음\n")
        
        # 결과 출력
        self._display_results(all_results)
        
        # 파일로 저장 (선택사항)
        if output_file:
            self._save_results(all_results, output_file)
        
        # CSV 파일로 저장 (선택사항)
        if csv_file:
            self._save_results_to_csv(all_results, csv_file)
    
    def _display_results(self, results: List[Tuple[str, List[Tuple[int, str, str]]]]):
        """결과를 콘솔에 출력"""
        print("\n" + "=" * 80)
        print("검색 결과")
        print("=" * 80 + "\n")
        
        if not results:
            print("매칭되는 내용이 없습니다.")
            return
        
        total_matches = 0
        for url, matches in results:
            total_matches += len(matches)
            print(f"\n📄 URL: {url}")
            print(f"   매칭 수: {len(matches)}")
            print("-" * 80)
            
            for line_num, keyword, line in matches:
                # 키워드 표시
                keyword_display = f"[{keyword}]" if len(keyword) < 30 else f"[{keyword[:27]}...]"
                # 줄 번호와 키워드 표시
                print(f"  줄 {line_num:5d} | 키워드: {keyword_display}")
                # 매칭된 줄 전체 출력
                print(f"  내용: {line}")
                print()
        
        print("\n" + "=" * 80)
        print(f"총 {len(results)}개 URL에서 {total_matches}개의 매칭을 발견했습니다.")
        print("=" * 80)
    
    def _save_results(self, results: List[Tuple[str, List[Tuple[int, str, str]]]], filepath: str):
        """결과를 파일로 저장"""
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write("웹 페이지 키워드 필터링 결과\n")
                f.write("=" * 80 + "\n\n")
                
                for url, matches in results:
                    f.write(f"URL: {url}\n")
                    f.write(f"매칭 수: {len(matches)}\n")
                    f.write("-" * 80 + "\n")
                    
                    for line_num, keyword, line in matches:
                        f.write(f"줄 {line_num} | 키워드: {keyword}\n")
                        f.write(f"내용: {line}\n\n")
                    
                    f.write("\n")
            
            print(f"\n✓ 결과가 '{filepath}'에 저장되었습니다.")
        except Exception as e:
            print(f"⚠️  파일 저장 오류: {e}")
    
    def _save_results_to_csv(self, results: List[Tuple[str, List[Tuple[int, str, str]]]], filepath: str):
        """결과를 CSV 파일로 저장 (pandas DataFrame 사용)"""
        try:
            # DataFrame용 데이터 준비
            data = []
            for url, matches in results:
                for line_num, keyword, line in matches:
                    data.append({
                        'URL': url,
                        '줄번호': line_num,
                        '키워드': keyword,
                        '매칭내용': line
                    })
            
            # DataFrame 생성
            if data:
                df = pd.DataFrame(data)
                
                # CSV 파일로 저장
                df.to_csv(filepath, index=False, encoding='utf-8-sig')  # utf-8-sig: Excel 호환성
                
                print(f"\n✓ CSV 결과가 '{filepath}'에 저장되었습니다.")
                print(f"  총 {len(df)}개의 매칭이 저장되었습니다.")
            else:
                print(f"\n⚠️  저장할 데이터가 없습니다.")
        except Exception as e:
            print(f"⚠️  CSV 파일 저장 오류: {e}")


def main():
    parser = argparse.ArgumentParser(
        description='웹 페이지에서 키워드를 검색하여 매칭되는 줄을 필터링합니다.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
사용 예제:
  python web_filter.py urls.txt keywords.txt
  python web_filter.py urls.txt keywords.txt -o results.txt
  python web_filter.py urls.txt keywords.txt -c results.csv
  python web_filter.py urls.txt keywords.txt -o results.txt -c results.csv

파일 형식:
  urls.txt      - 한 줄에 하나의 URL
  keywords.txt  - 한 줄에 하나의 키워드
                  정규식의 경우 앞에 <<REGEX>> 추가
                  예: <<REGEX>>\\d{3}-\\d{4}

주석:
  '#'로 시작하는 줄은 무시됩니다.
        """
    )
    
    parser.add_argument('urls_file', help='URL 목록이 저장된 파일')
    parser.add_argument('keywords_file', help='키워드 목록이 저장된 파일')
    parser.add_argument('-o', '--output', help='결과를 저장할 텍스트 파일 경로', default=None)
    parser.add_argument('-c', '--csv', help='결과를 저장할 CSV 파일 경로', default=None)
    
    args = parser.parse_args()
    
    # 필터 실행
    filter_tool = WebLineFilter(args.urls_file, args.keywords_file)
    filter_tool.run(args.output, args.csv)


if __name__ == '__main__':
    main()
