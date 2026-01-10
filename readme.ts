# ADB Device Manager - TypeScript Version

TypeScript로 작성된 ADB 장치 관리 라이브러리입니다.

## 설치

```bash
npm install
```

## 빌드

```bash
npm run build
```

## 실행

```bash
npm start
# 또는 개발 모드
npm run dev
```

## 사용법

### 기본 사용

```typescript
import { ADBManager } from './adb_manager';

const manager = new ADBManager();

// ADB 경로 설정
manager.setAdbPath('C:\\platform-tools'); // 사용자 지정 경로
// 또는
manager.setAdbPath(null); // 현재 경로 사용

// 설정
manager.setSequentialMode(true);  // 순차 실행
manager.setTimeValue(5);          // [TESTTIME] 변수 값 (정수)
manager.setPairCount(2);          // 짝지을 보드 대수

// 장치 목록 가져오기
await manager.refreshDevices();
const devices = manager.getDevices();
console.log('연결된 장치:', devices);

// 명령 실행
await manager.executeCommand(
    'adb -s [ADBID] shell getprop',
    devices[0].id
);
```

### ADB 경로 설정

```typescript
const manager = new ADBManager();

// 사용자 지정 경로 사용
manager.setAdbPath('C:\\platform-tools');

// 현재 Python/TypeScript 코드 실행 경로 사용
manager.setAdbPath(null);
```

### 변수 사용

#### [ADBID] - 장치 ID
```typescript
await manager.executeCommand(
    'adb -s [ADBID] shell getprop',
    'emulator-5554'
);
```

#### [ADBNUM] - 장치 순서 번호
```typescript
await manager.executeCommand(
    'adb -s [ADBID] pull /sdcard/log.txt log_[ADBNUM].txt',
    'All Devices'
);
```

#### [[ADBID]S] - 그룹 장치 ID (쉼표로 구분)
```typescript
manager.setPairCount(2); // 2개씩 묶음
await manager.executeCommand(
    'echo Processing: [[ADBID]S]',
    'All Devices'
);
// 결과: emulator-5554,emulator-5556
```

#### [TESTTIME] - 시간 값 (정수)
```typescript
manager.setTimeValue(10);
await manager.executeCommand(
    'adb -s [ADBID] shell sleep [TESTTIME]',
    'All Devices'
);
```

## API 참조

### ADBManager 클래스

#### 메서드

##### `setAdbPath(customPath: string | null): void`
- ADB 실행 경로를 설정합니다
- `customPath`: 사용자 지정 경로 (null이면 현재 경로 사용)

##### `refreshDevices(): Promise<DeviceInfo[]>`
- ADB 장치 목록을 가져옵니다

##### `executeCommand(commandTemplate: string, selectedDevice: string | 'All Devices'): Promise<void>`
- 명령을 실행합니다
- `commandTemplate`: 명령 템플릿 ([ADBID], [ADBNUM], [[ADBID]S], [TESTTIME] 변수 사용)
- `selectedDevice`: 장치 ID 또는 'All Devices'

##### `setSequentialMode(sequential: boolean): void`
- 순차/동시 실행 모드를 설정합니다

##### `setTimeValue(time: number): void`
- [TESTTIME] 변수 값을 설정합니다 (정수로 변환됨)

##### `setPairCount(count: number): void`
- 짝지을 보드 대수를 설정합니다 (1 이상)

##### `getDevices(): DeviceInfo[]`
- 연결된 장치 목록을 반환합니다

##### `getConfig(): Config | null`
- JSON 설정을 반환합니다

### 인터페이스

#### `DeviceInfo`
```typescript
interface DeviceInfo {
    id: string;          // 장치 ID
    fullLine: string;    // adb devices -l 전체 출력
}
```

#### `Command`
```typescript
interface Command {
    name: string;        // 명령 이름
    command: string;     // 명령 템플릿
}
```

#### `Column`
```typescript
interface Column {
    title: string;       // 열 제목
    commands: Command[]; // 명령 목록
}
```

#### `Config`
```typescript
interface Config {
    window?: WindowConfig; // 윈도우 크기 설정 (선택사항)
    columns: Column[];     // 열 목록
}
```

#### `WindowConfig`
```typescript
interface WindowConfig {
    width: number;   // 윈도우 가로 크기 (픽셀)
    height: number;  // 윈도우 세로 크기 (픽셀)
}
```

## JSON 설정 파일

### 윈도우 크기 설정

```json
{
    "window": {
        "width": 1200,
        "height": 700
    },
    "columns": [...]
}
```

### 전체 설정 예시

```json
{
    "window": {
        "width": 1400,
        "height": 800
    },
    "columns": [
        {
            "title": "기본 명령",
            "commands": [
                {
                    "name": "화면 캡처",
                    "command": "adb -s [ADBID] shell screencap -p /sdcard/screen.png"
                }
            ]
        }
    ]
}
```

## 예시

### 1. 모든 장치에서 배터리 정보 가져오기
```typescript
await manager.executeCommand(
    'adb -s [ADBID] shell dumpsys battery',
    'All Devices'
);
```

### 2. 장치별로 파일 저장
```typescript
await manager.executeCommand(
    'adb -s [ADBID] pull /sdcard/log.txt log_[ADBNUM].txt',
    'All Devices'
);
// 결과: log_1.txt, log_2.txt, log_3.txt, ...
```

### 3. 그룹으로 묶어서 처리
```typescript
manager.setPairCount(3); // 3개씩 묶음
await manager.executeCommand(
    'python process_devices.py --devices [[ADBID]S]',
    'All Devices'
);
// 그룹 1: device1,device2,device3
// 그룹 2: device4,device5,device6
```

### 4. ADB 경로 지정하여 실행
```typescript
// Windows
manager.setAdbPath('C:\\Users\\Username\\platform-tools');

// Linux/Mac
manager.setAdbPath('/home/user/android-sdk/platform-tools');

await manager.executeCommand(
    'adb -s [ADBID] devices',
    'All Devices'
);
```

## 주의사항

- [TESTTIME] 값은 자동으로 정수로 변환됩니다
- [[ADBID]S]는 'All Devices' 모드에서만 사용 가능합니다
- ADB 경로를 지정하지 않으면 현재 코드 실행 경로를 사용합니다
- Windows에서는 `cd /d` 명령을, Linux/Mac에서는 `cd` 명령을 사용합니다

## 변수 설명

### [ADBID]
- 선택된 장치의 ADB ID
- 예시: `emulator-5554`

### [ADBNUM]
- 장치의 순서 번호 (1부터 시작)
- 예시: `1`, `2`, `3`

### [ADBIDS]
- 쉼표로 연결된 장치 ID 목록
- 예시: `emulator-5554,emulator-5556`
- All Devices 모드 전용

### [TESTTIME]
- UI에 입력된 시간 값 (정수, 초)
- 예시: `5`, `10`

### [CURTIME]
- 명령 실행 시점의 날짜시간
- 형식: `YYYYMMDD_HHMMSS`
- 예시: `20260110_143025`

### [CURTIME] 사용 예시

```typescript
// 타임스탬프가 포함된 로그 파일
await manager.executeCommand(
    'adb -s [ADBID] logcat -d > log_[ADBNUM]_[CURTIME].txt',
    'All Devices'
);
// 결과: log_1_20260110_143025.txt, log_2_20260110_143025.txt

// 타임스탬프 스크린샷
await manager.executeCommand(
    'adb -s [ADBID] exec-out screencap -p > screenshot_[CURTIME].png',
    device.id
);
// 결과: screenshot_20260110_143025.png
```

## JSON 설정 파일 구조

### settings 섹션
초기값 및 환경 설정을 지정합니다:

```json
{
    "settings": {
        "adb_path": "C:\\platform-tools",
        "use_custom_adb_path": true,
        "testtime": 10,
        "pair_count": 3
    },
    "window": {
        "width": 1200,
        "height": 700
    },
    "columns": [...]
}
```

#### settings 항목 설명

| 항목 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `adb_path` | string | `""` | ADB 실행 경로 (빈 문자열이면 현재 경로) |
| `use_custom_adb_path` | boolean | `false` | 사용자 지정 ADB 경로 사용 여부 |
| `testtime` | integer | `5` | [TESTTIME] 변수의 초기값 (초) |
| `pair_count` | integer | `2` | 짝지을 보드 대수 초기값 |

#### 예시

**기본 설정 (현재 경로 사용)**
```json
{
    "settings": {
        "adb_path": "",
        "use_custom_adb_path": false,
        "testtime": 5,
        "pair_count": 2
    }
}
```

**사용자 지정 경로 사용**
```json
{
    "settings": {
        "adb_path": "C:\\Users\\MyUser\\android-sdk\\platform-tools",
        "use_custom_adb_path": true,
        "testtime": 10,
        "pair_count": 4
    }
}
```

**Linux/Mac 경로**
```json
{
    "settings": {
        "adb_path": "/home/user/android-sdk/platform-tools",
        "use_custom_adb_path": true,
        "testtime": 3,
        "pair_count": 2
    }
}
```

### 전체 설정 예시

```json
{
    "settings": {
        "adb_path": "C:\\platform-tools",
        "use_custom_adb_path": true,
        "testtime": 10,
        "pair_count": 3
    },
    "window": {
        "width": 1400,
        "height": 800
    },
    "columns": [
        {
            "title": "기본 명령",
            "commands": [
                {
                    "name": "화면 캡처",
                    "command": "adb -s [ADBID] shell screencap -p /sdcard/screen.png"
                },
                {
                    "name": "[TESTTIME]초 대기",
                    "command": "adb -s [ADBID] shell sleep [TESTTIME]"
                }
            ]
        },
        {
            "title": "그룹 명령",
            "commands": [
                {
                    "name": "그룹 정보",
                    "command": "echo Devices: [ADBIDS]"
                }
            ]
        }
    ]
}
```

### 주의사항

- `adb_path`는 **adb.exe가 있는 디렉토리** 경로를 지정합니다
- Windows 경로는 백슬래시를 이중으로 입력: `C:\\path\\to\\adb`
- `use_custom_adb_path`가 `false`면 `adb_path` 값은 무시됩니다
- `testtime`과 `pair_count`는 UI에서 변경 가능하며, 여기서는 초기값만 지정합니다
- settings 섹션을 생략하면 모든 값이 기본값으로 설정됩니다
