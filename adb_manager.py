import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
import subprocess
import json
import os
import re
from typing import List, Dict

class ADBManager:
    def __init__(self, root):
        self.root = root
        self.root.title("ADB Device Manager")
        self.root.geometry("800x600")
        
        # ADB 장치 목록
        self.devices = []
        
        # UI 구성
        self.setup_ui()
        
        # 초기 장치 목록 로드
        self.refresh_devices()
        
        # JSON 설정 로드
        self.load_commands()
    
    def setup_ui(self):
        # 상단 프레임 (장치 선택)
        top_frame = ttk.Frame(self.root, padding="10")
        top_frame.pack(fill=tk.X)
        
        ttk.Label(top_frame, text="ADB Device:").pack(side=tk.LEFT, padx=5)
        
        self.device_combo = ttk.Combobox(top_frame, width=60, state="readonly")
        self.device_combo.pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)
        
        refresh_btn = ttk.Button(top_frame, text="새로고침", command=self.refresh_devices)
        refresh_btn.pack(side=tk.LEFT, padx=5)
        
        # 구분선
        ttk.Separator(self.root, orient=tk.HORIZONTAL).pack(fill=tk.X, pady=5)
        
        # 중간 프레임 (명령 버튼들)
        self.commands_frame = ttk.Frame(self.root, padding="10")
        self.commands_frame.pack(fill=tk.BOTH, expand=True)
        
        # 버튼을 담을 스크롤 가능한 프레임
        canvas = tk.Canvas(self.commands_frame)
        scrollbar = ttk.Scrollbar(self.commands_frame, orient="vertical", command=canvas.yview)
        self.scrollable_frame = ttk.Frame(canvas)
        
        self.scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        
        canvas.create_window((0, 0), window=self.scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 하단 프레임 (로그 출력)
        bottom_frame = ttk.Frame(self.root, padding="10")
        bottom_frame.pack(fill=tk.BOTH, expand=True)
        
        ttk.Label(bottom_frame, text="실행 결과:").pack(anchor=tk.W)
        
        self.log_text = scrolledtext.ScrolledText(bottom_frame, height=10, wrap=tk.WORD)
        self.log_text.pack(fill=tk.BOTH, expand=True)
    
    def refresh_devices(self):
        """ADB 장치 목록을 새로고침합니다."""
        try:
            result = subprocess.run(
                ["adb", "devices", "-l"],
                capture_output=True,
                text=True,
                encoding='utf-8'
            )
            
            if result.returncode != 0:
                messagebox.showerror("오류", "ADB 명령 실행 실패")
                return
            
            # 장치 목록 파싱
            self.devices = []
            lines = result.stdout.strip().split('\n')[1:]  # 첫 줄("List of devices attached") 제외
            
            for line in lines:
                line = line.strip()
                if line and not line.startswith('*'):
                    # 장치 ID 추출 (첫 번째 공백 전까지)
                    parts = line.split()
                    if len(parts) >= 2:
                        self.devices.append(line)
            
            # 콤보박스 업데이트
            device_list = ["all devices"] + self.devices
            self.device_combo['values'] = device_list
            
            if device_list:
                self.device_combo.current(0)
            
            self.log(f"장치 {len(self.devices)}개 발견")
            
        except FileNotFoundError:
            messagebox.showerror("오류", "ADB를 찾을 수 없습니다. ADB가 설치되어 있고 PATH에 등록되어 있는지 확인하세요.")
        except Exception as e:
            messagebox.showerror("오류", f"장치 목록 로드 실패: {str(e)}")
    
    def extract_device_id(self, device_string: str) -> str:
        """장치 문자열에서 ADB ID를 추출합니다."""
        if not device_string:
            return ""
        # 첫 번째 단어(공백 전까지)가 device ID
        return device_string.split()[0]
    
    def load_commands(self):
        """JSON 파일에서 명령어 설정을 로드합니다."""
        config_file = "adb_commands.json"
        
        # 기본 설정 파일이 없으면 생성
        if not os.path.exists(config_file):
            default_config = {
                "commands": [
                    {
                        "name": "화면 캡처",
                        "command": "adb -s ADBID shell screencap -p /sdcard/screen.png"
                    },
                    {
                        "name": "앱 목록 보기",
                        "command": "adb -s ADBID shell pm list packages"
                    },
                    {
                        "name": "디바이스 정보",
                        "command": "adb -s ADBID shell getprop"
                    },
                    {
                        "name": "재부팅",
                        "command": "adb -s ADBID reboot"
                    },
                    {
                        "name": "로그캣 보기",
                        "command": "adb -s ADBID logcat -d"
                    }
                ]
            }
            with open(config_file, 'w', encoding='utf-8') as f:
                json.dump(default_config, f, indent=4, ensure_ascii=False)
            self.log(f"기본 설정 파일 생성: {config_file}")
        
        # JSON 로드
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)
            
            # 버튼 생성
            for idx, cmd_info in enumerate(config.get('commands', [])):
                name = cmd_info.get('name', f'명령 {idx+1}')
                command = cmd_info.get('command', '')
                
                btn = ttk.Button(
                    self.scrollable_frame,
                    text=name,
                    command=lambda c=command: self.execute_command(c)
                )
                btn.pack(fill=tk.X, pady=2, padx=5)
            
            self.log(f"{len(config.get('commands', []))}개 명령 로드 완료")
            
        except Exception as e:
            messagebox.showerror("오류", f"설정 파일 로드 실패: {str(e)}")
    
    def execute_command(self, command_template: str):
        """명령어를 실행합니다."""
        selected = self.device_combo.get()
        
        if not selected:
            messagebox.showwarning("경고", "장치를 선택하세요.")
            return
        
        # 실행할 명령어 목록
        commands_to_run = []
        
        if selected == "all devices":
            # 모든 장치에 대해 실행
            for device in self.devices:
                device_id = self.extract_device_id(device)
                cmd = command_template.replace("ADBID", device_id)
                commands_to_run.append((device_id, cmd))
        else:
            # 선택된 장치에 대해서만 실행
            device_id = self.extract_device_id(selected)
            cmd = command_template.replace("ADBID", device_id)
            commands_to_run.append((device_id, cmd))
        
        # 명령 실행
        for device_id, cmd in commands_to_run:
            self.log(f"\n[{device_id}] 실행: {cmd}")
            try:
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    shell=True,
                    encoding='utf-8'
                )
                
                if result.stdout:
                    self.log(f"[{device_id}] 출력:\n{result.stdout}")
                if result.stderr:
                    self.log(f"[{device_id}] 에러:\n{result.stderr}")
                    
            except Exception as e:
                self.log(f"[{device_id}] 실행 실패: {str(e)}")
    
    def log(self, message: str):
        """로그 텍스트 위젯에 메시지를 추가합니다."""
        self.log_text.insert(tk.END, message + "\n")
        self.log_text.see(tk.END)
        self.root.update()

def main():
    root = tk.Tk()
    app = ADBManager(root)
    root.mainloop()

if __name__ == "__main__":
    main()
