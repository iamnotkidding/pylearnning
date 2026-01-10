# ADB Device Manager

Windows에서 실행되는 ADB 장치 관리 GUI 프로그램입니다.

## 기능

1. **장치 선택**: 상단 콤보박스에서 연결된 ADB 장치를 선택
2. **All Devices**: 모든 장치에 동시에 명령 실행
3. **순차/동시 실행**: All Devices 선택 시 순차 또는 동시 실행 선택 가능
4. **변수 지원**: ADBID, ADBNUM, ADBIDS, TIME 네 가지 변수를 명령어에서 사용 가능
5. **그룹 실행**: 여러 장치를 묶어서 한 번에 명령 실행 (ADBIDS)
6. **스마트 프로세스 관리**: 같은 장치에 새 명령 실행 시 이전 명령 자동 취소
7. **버튼 히스토리**: 최근 눌렀던 버튼을 초록색으로 강조 표시
8. **열별 레이아웃**: JSON 설정에서 명령어를 여러 열로 구성 가능
9. **비동기 실행**: 명령 실행 시 UI가 blocking되지 않음 (Threading 사용)
10. **실시간 로그**: 명령 실행 결과를 하단에 표시 (취소된 명령은 빨간색)

## 설치 및 실행

### 필요사항
- Python 3.7 이상
- ADB (Android Debug Bridge)가 설치되어 있고 PATH에 등록되어 있어야 함

### 실행 방법
```bash
python adb_manager.py
```

## 주요 기능 설명

### 1. 명령어 변수 시스템

#### ADBID
- **설명**: 선택된 장치의 ADB ID로 자동 치환
- **사용 가능**: 단일 장치, All Devices
- **예시**: `adb -s ADBID shell getprop`
- **결과**: `adb -s emulator-5554 shell getprop`

#### ADBNUM
- **설명**: 장치의 순서 인덱스 번호 (1부터 시작)
- **사용 가능**: 단일 장치, All Devices
- **용도**: 각 장치별로 고유한 파일명이나 식별자가 필요할 때
- **예시**: `adb -s ADBID pull /sdcard/log.txt device_ADBNUM.txt`

#### ADBIDS (새로운 기능!)
- **설명**: 짝지을 보드 대수만큼 장치 ID를 쉼표(,)로 연결 (공백 없음)
- **사용 가능**: **All Devices 선택 시에만 사용 가능**
- **용도**: 여러 장치를 그룹으로 묶어서 한 번에 처리할 때
- **예시**: 
  - 짝지을 보드 대수 = 2
  - 장치: emulator-5554, emulator-5556, emulator-5558, emulator-5560
  - 그룹 1: `emulator-5554,emulator-5556`
  - 그룹 2: `emulator-5558,emulator-5560`

#### TIME
- **설명**: UI에 입력된 시간 값(초)으로 치환
- **사용 가능**: 모든 경우
- **예시**: `adb -s ADBID shell sleep TIME` (TIME=5 입력 시)

### 2. ADBIDS 그룹 실행 상세 설명

**짝지을 보드 대수**: UI에서 입력하는 값으로, 몇 개의 장치를 묶어서 한 그룹으로 처리할지 결정합니다.

**실행 방식:**
1. All Devices 선택
2. 짝지을 보드 대수 = 2로 설정
3. 전체 장치: [A, B, C, D, E] (5개)
4. 그룹 생성:
   - 그룹 1: A,B
   - 그룹 2: C,D
   - 그룹 3: E (남은 장치)
5. 각 그룹마다 명령 한 번씩 실행 (총 3번)

**예시 명령어:**
```json
{
    "name": "그룹 장치 정보",
    "command": "echo Devices: ADBIDS"
}
```

실행 결과:
```
[그룹: emulator-5554,emulator-5556] 실행: echo Devices: emulator-5554,emulator-5556
[그룹: emulator-5554,emulator-5556] 출력: Devices: emulator-5554,emulator-5556

[그룹: emulator-5558,emulator-5560] 실행: echo Devices: emulator-5558,emulator-5560
[그룹: emulator-5558,emulator-5560] 출력: Devices: emulator-5558,emulator-5560
```

### 3. ADBIDS 활용 예시

**쉘 스크립트에서 그룹 처리:**
```json
{
    "name": "그룹별 파일 다운로드",
    "command": "for id in $(echo ADBIDS | tr ',' ' '); do adb -s $id pull /sdcard/test.txt ${id}_test.txt; done"
}
```
- ADBIDS가 `device1,device2`로 치환됨
- 쉘에서 쉼표를 공백으로 변환 후 반복 처리
- 각 장치에서 파일 다운로드

**Python 스크립트에서 그룹 처리:**
```json
{
    "name": "Python으로 그룹 처리",
    "command": "python -c \"devices='ADBIDS'.split(','); [print(f'Processing {d}') for d in devices]\""
}
```

**배치 파일에서 사용:**
```json
{
    "name": "배치로 그룹 처리",
    "command": "call process_devices.bat ADBIDS"
}
```

### 4. 변수 비교표

| 변수 | 단일 장치 | All Devices | 값 형태 | 예시 |
|------|----------|------------|---------|------|
| ADBID | ✅ | ✅ | 단일 ID | `emulator-5554` |
| ADBNUM | ✅ | ✅ | 숫자 | `1`, `2`, `3` |
| ADBIDS | ❌ | ✅ | 쉼표 구분 ID 목록 | `device1,device2` |
| TIME | ✅ | ✅ | 숫자 | `5`, `10` |

### 5. 실행 흐름 비교

**ADBID/ADBNUM 사용 시:**
```
장치 4개 (A, B, C, D) → 4번 실행
- 명령 1: ADBID=A, ADBNUM=1
- 명령 2: ADBID=B, ADBNUM=2
- 명령 3: ADBID=C, ADBNUM=3
- 명령 4: ADBID=D, ADBNUM=4
```

**ADBIDS 사용 시 (짝지을 보드 대수=2):**
```
장치 4개 (A, B, C, D) → 2번 실행
- 명령 1: ADBIDS=A,B
- 명령 2: ADBIDS=C,D
```

## JSON 설정 파일 (adb_commands.json)

### 사용 가능한 변수:
- `ADBID`: 선택된 장치의 ID
- `ADBNUM`: 장치의 순서 번호 (1, 2, 3, ...)
- `ADBIDS`: 쉼표로 연결된 장치 ID 목록 (All Devices 전용)
- `TIME`: UI에 입력된 시간 값(초)

### 예시:
```json
{
    "columns": [
        {
            "title": "개별 장치 명령",
            "commands": [
                {
                    "name": "로그 다운로드",
                    "command": "adb -s ADBID pull /sdcard/log.txt log_ADBNUM.txt"
                }
            ]
        },
        {
            "title": "그룹 명령 (ADBIDS)",
            "commands": [
                {
                    "name": "그룹 정보 출력",
                    "command": "echo Processing group: ADBIDS"
                },
                {
                    "name": "그룹별 일괄 처리",
                    "command": "python batch_process.py ADBIDS"
                }
            ]
        }
    ]
}
```

## 변경 사항 (v6.0)

### ADBIDS 변수 추가
- 여러 장치를 그룹으로 묶어서 처리
- 짝지을 보드 대수 설정으로 그룹 크기 조절
- All Devices 모드 전용

### 그룹 실행 기능
- 지정된 수만큼 장치를 묶어 한 번에 명령 실행
- 순차/동시 실행 모드 지원
- 그룹별 독립적인 프로세스 관리

## 사용 예시

### 예시 1: 2개씩 묶어서 처리
```
장치: A, B, C, D, E, F (총 6개)
짝지을 보드 대수: 2

그룹 1: A,B
그룹 2: C,D
그룹 3: E,F

명령 3번 실행
```

### 예시 2: 3개씩 묶어서 처리
```
장치: A, B, C, D, E (총 5개)
짝지을 보드 대수: 3

그룹 1: A,B,C
그룹 2: D,E

명령 2번 실행
```

### 예시 3: 그룹별 스크립트 실행
```json
{
    "name": "그룹 일괄 처리",
    "command": "python process_group.py --devices ADBIDS --timeout TIME"
}
```

Python 스크립트 (process_group.py):
```python
import sys
devices = sys.argv[2].split(',')
for device in devices:
    print(f"Processing {device}")
```

## 주의사항

- **ADBIDS는 All Devices 선택 시에만 사용 가능**합니다
- ADBIDS를 단일 장치에 사용하려고 하면 경고 메시지가 표시됩니다
- 짝지을 보드 대수는 1 이상의 정수여야 합니다
- 장치 수가 짝지을 보드 대수로 나누어떨어지지 않으면 마지막 그룹은 적은 수의 장치를 포함합니다
- ADBIDS 값에는 공백이 없고 쉼표(,)만 포함됩니다
- 그룹 실행 시 모든 장치의 이전 명령이 취소됩니다
- 동시 실행 시 로그 출력 순서가 뒤섞일 수 있습니다
