# WebADB 자동 설치 서비스

WebUSB API를 활용하여 브라우저에서 직접 안드로이드 기기에 APK를 설치하는 웹 서비스입니다.

## 🌟 주요 기능

- ✅ **별도 프로그램 설치 불필요**: Chrome 브라우저만 있으면 됩니다
- ✅ **WebUSB 기반**: 브라우저에서 직접 USB 기기와 통신
- ✅ **자동 설치**: 서버에서 APK를 다운로드하고 자동으로 설치
- ✅ **관리자 페이지**: APK 업로드 및 관리 인터페이스
- ✅ **실시간 진행률**: 다운로드 및 설치 진행 상황 표시

## 📋 사용 요구사항

### 사용자
- Chrome 브라우저 (버전 61 이상)
- USB 디버깅이 활성화된 안드로이드 기기
- USB 케이블

### 서버
- Node.js 14 이상
- npm 또는 yarn

## 🚀 설치 방법

### 1. 프로젝트 클론 및 의존성 설치

```bash
# 의존성 설치
npm install
```

### 2. 프로젝트 구조 생성

```
webadb-auto-installer/
├── server.js              # Express 서버
├── package.json           # 프로젝트 설정
├── apk-config.json        # APK 설정 (자동 생성)
├── apks/                  # APK 저장소 (자동 생성)
└── public/                # 정적 파일
    ├── index.html         # 사용자 페이지
    ├── admin.html         # 관리자 페이지
    ├── app.js             # 기본 WebADB 클라이언트
    └── app-advanced.js    # 고급 WebADB 클라이언트 (@yume-chan/adb 사용)
```

### 3. public 폴더 생성 및 파일 배치

```bash
mkdir -p public
# index.html, admin.html, app.js 파일들을 public 폴더로 이동
```

### 4. 서버 실행

```bash
npm start
```

또는 개발 모드로 실행:

```bash
npm run dev
```

서버는 기본적으로 `http://localhost:3000`에서 실행됩니다.

## 📱 사용 방법

### 관리자: APK 업로드

1. 관리자 페이지 접속: `http://localhost:3000/admin`
2. APK 파일을 드래그 앤 드롭하거나 클릭하여 선택
3. 업로드 완료 대기

### 사용자: APK 설치

1. 사용자 페이지 접속: `http://localhost:3000`
2. 안드로이드 기기의 USB 디버깅 활성화
   - 설정 → 휴대전화 정보 → 빌드 번호 7번 탭
   - 설정 → 개발자 옵션 → USB 디버깅 활성화
3. USB 케이블로 PC와 기기 연결
4. "기기 연결하기" 버튼 클릭
5. Chrome의 USB 기기 선택 대화상자에서 안드로이드 기기 선택
6. 기기에서 USB 디버깅 허용 확인
7. "앱 자동 설치" 버튼 클릭
8. 설치 완료 대기

## 🔧 WebADB 구현 방식

이 프로젝트는 두 가지 구현을 제공합니다:

### 1. 기본 버전 (app.js)
- WebUSB API를 직접 사용
- 간단한 구조
- 교육 목적 및 프로토타입에 적합

### 2. 고급 버전 (app-advanced.js) ⭐ 권장
- `@yume-chan/adb` 라이브러리 사용
- 완전한 ADB 프로토콜 구현
- 실제 프로덕션 환경에 적합

**고급 버전 사용 방법:**

index.html의 스크립트 태그를 수정:

```html
<!-- 기본 버전 -->
<script type="module" src="app.js"></script>

<!-- 고급 버전으로 변경 -->
<script type="module" src="app-advanced.js"></script>
```

## 🔐 보안 고려사항

### HTTPS 필수
WebUSB API는 보안상의 이유로 HTTPS 환경에서만 작동합니다.

로컬 개발 시:
- `localhost`는 예외로 HTTP 허용
- 실제 배포 시 반드시 HTTPS 사용

### SSL 인증서 설정 (프로덕션)

```javascript
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('path/to/private.key'),
  cert: fs.readFileSync('path/to/certificate.crt')
};

https.createServer(options, app).listen(443);
```

## 📊 API 엔드포인트

### APK 관리

**APK 정보 조회**
```
GET /api/apk/info
```

**APK 다운로드**
```
GET /api/apk/download
```

**APK 업로드** (관리자)
```
POST /api/apk/upload
Content-Type: multipart/form-data
Body: apk (file)
```

**APK 삭제** (관리자)
```
DELETE /api/apk/delete
```

### 통계

**통계 조회**
```
GET /api/stats
```

**연결 통계 기록**
```
POST /api/stats/connection
```

**설치 통계 기록**
```
POST /api/stats/install
Body: { success: boolean }
```

## 🐛 문제 해결

### "WebUSB를 지원하지 않습니다" 오류
- Chrome 브라우저 버전 확인 (61 이상 필요)
- `chrome://flags/#enable-experimental-web-platform-features` 활성화

### 기기가 목록에 나타나지 않음
- USB 디버깅 활성화 확인
- USB 케이블 연결 확인
- 다른 USB 포트 시도
- 기기에서 "USB 디버깅 허용" 대화상자 확인

### 설치 실패
- 기기의 저장 공간 확인
- APK 파일 무결성 확인
- 로그 콘솔에서 자세한 오류 메시지 확인

### HTTPS 관련 오류
- 로컬 개발: localhost 사용
- 프로덕션: 유효한 SSL 인증서 설치

## 🔄 업데이트 계획

- [ ] 다중 APK 관리
- [ ] 사용자 인증 시스템
- [ ] 설치 이력 관리
- [ ] 기기별 설치 통계
- [ ] APK 버전 관리

## 📝 라이선스

MIT License

## 🤝 기여

이슈 및 풀 리퀘스트를 환영합니다!

## 📧 문의

프로젝트 관련 문의사항이 있으시면 이슈를 생성해주세요.

---

## 🎯 브라우저별 WebUSB 지원 현황

| 브라우저 | 지원 여부 | 비고 |
|---------|----------|------|
| Chrome | ✅ | 버전 61+ |
| Edge | ✅ | Chromium 기반 |
| Opera | ✅ | Chromium 기반 |
| Firefox | ❌ | 지원 안 함 |
| Safari | ❌ | 지원 안 함 |

## 🔗 참고 자료

- [WebUSB API](https://developer.mozilla.org/en-US/docs/Web/API/USB)
- [@yume-chan/adb](https://github.com/yume-chan/ya-webadb)
- [Android Debug Bridge (ADB)](https://developer.android.com/studio/command-line/adb)
