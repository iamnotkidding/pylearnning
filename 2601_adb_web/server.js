// server.js - WebADB 서비스를 위한 백엔드 서버
// APK 파일 관리 및 배포를 담당

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3000;

// CORS 활성화
app.use(cors());
app.use(express.json());

// 정적 파일 서빙 (프론트엔드)
app.use(express.static('public'));

// APK 저장소 디렉토리
const APK_DIR = path.join(__dirname, 'apks');
if (!fs.existsSync(APK_DIR)) {
    fs.mkdirSync(APK_DIR, { recursive: true });
}

// 파일 업로드 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, APK_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueName = `app-${Date.now()}.apk`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (path.extname(file.originalname).toLowerCase() === '.apk') {
            cb(null, true);
        } else {
            cb(new Error('APK 파일만 업로드 가능합니다.'));
        }
    },
    limits: {
        fileSize: 200 * 1024 * 1024 // 200MB 제한
    }
});

// APK 설정 저장
let currentAPK = {
    filename: null,
    originalName: null,
    uploadDate: null,
    size: 0
};

// APK 설정 파일 경로
const CONFIG_FILE = path.join(__dirname, 'apk-config.json');

// 설정 로드
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            currentAPK = JSON.parse(data);
            console.log('APK 설정 로드:', currentAPK);
        }
    } catch (error) {
        console.error('설정 로드 실패:', error);
    }
}

// 설정 저장
function saveConfig() {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(currentAPK, null, 2));
        console.log('APK 설정 저장:', currentAPK);
    } catch (error) {
        console.error('설정 저장 실패:', error);
    }
}

// 라우트: 메인 페이지
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 라우트: 관리자 페이지
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API: 현재 APK 정보 조회
app.get('/api/apk/info', (req, res) => {
    if (!currentAPK.filename) {
        return res.status(404).json({
            success: false,
            message: '등록된 APK가 없습니다.'
        });
    }
    
    res.json({
        success: true,
        data: currentAPK
    });
});

// API: APK 다운로드
app.get('/api/apk/download', (req, res) => {
    if (!currentAPK.filename) {
        return res.status(404).json({
            success: false,
            message: '등록된 APK가 없습니다.'
        });
    }

    const filePath = path.join(APK_DIR, currentAPK.filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({
            success: false,
            message: 'APK 파일을 찾을 수 없습니다.'
        });
    }

    // APK 파일 전송
    res.download(filePath, currentAPK.originalName || 'app.apk', (err) => {
        if (err) {
            console.error('다운로드 오류:', err);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: '다운로드 실패'
                });
            }
        } else {
            console.log('APK 다운로드:', currentAPK.filename);
        }
    });
});

// API: APK 업로드 (관리자용)
app.post('/api/apk/upload', upload.single('apk'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'APK 파일이 필요합니다.'
            });
        }

        // 기존 APK 파일 삭제 (있다면)
        if (currentAPK.filename) {
            const oldPath = path.join(APK_DIR, currentAPK.filename);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
                console.log('기존 APK 삭제:', currentAPK.filename);
            }
        }

        // 새 APK 정보 저장
        currentAPK = {
            filename: req.file.filename,
            originalName: req.file.originalname,
            uploadDate: new Date().toISOString(),
            size: req.file.size
        };

        saveConfig();

        res.json({
            success: true,
            message: 'APK 업로드 성공',
            data: currentAPK
        });

    } catch (error) {
        console.error('업로드 오류:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// API: APK 삭제 (관리자용)
app.delete('/api/apk/delete', (req, res) => {
    try {
        if (!currentAPK.filename) {
            return res.status(404).json({
                success: false,
                message: '삭제할 APK가 없습니다.'
            });
        }

        const filePath = path.join(APK_DIR, currentAPK.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        currentAPK = {
            filename: null,
            originalName: null,
            uploadDate: null,
            size: 0
        };

        saveConfig();

        res.json({
            success: true,
            message: 'APK 삭제 완료'
        });

    } catch (error) {
        console.error('삭제 오류:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// API: 사용 통계
let stats = {
    totalConnections: 0,
    successfulInstalls: 0,
    failedInstalls: 0
};

app.get('/api/stats', (req, res) => {
    res.json({
        success: true,
        data: stats
    });
});

app.post('/api/stats/connection', (req, res) => {
    stats.totalConnections++;
    res.json({ success: true });
});

app.post('/api/stats/install', (req, res) => {
    const { success } = req.body;
    if (success) {
        stats.successfulInstalls++;
    } else {
        stats.failedInstalls++;
    }
    res.json({ success: true });
});

// 에러 핸들링
app.use((err, req, res, next) => {
    console.error('서버 오류:', err);
    res.status(500).json({
        success: false,
        message: err.message || '서버 오류가 발생했습니다.'
    });
});

// 서버 시작
loadConfig();

app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║  WebADB 자동 설치 서비스 서버 실행 중     ║
╚════════════════════════════════════════════╝

🌐 URL: http://localhost:${PORT}
📱 사용자 페이지: http://localhost:${PORT}
⚙️  관리자 페이지: http://localhost:${PORT}/admin
📦 APK 저장 경로: ${APK_DIR}

서버가 정상적으로 시작되었습니다.
    `);
});

module.exports = app;
