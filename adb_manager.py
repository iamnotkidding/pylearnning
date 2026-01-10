import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext, filedialog
import subprocess
import json
import os
import re
import threading
from typing import List, Dict
from datetime import datetime

class ADBManager:
    def __init__(self, root):
        self.root = root
        self.root.title("ADB Device Manager")
        # 윈도우 크기는 JSON 설정에서 로드됨
        
        # ADB 장치 목록
        self.devices = []
        
        # 순차 실행 여부
        self.sequential_var = tk.BooleanVar(value=True)
        
        # ADB 경로 사용 여부
        self.use_custom_adb_path = tk.BooleanVar(value=False)
        
        # 장치별 실행 중인 프로세스 관리 (device_id -> process)
        self.running_processes = {}
        
        # 장치별 실행 중인 스레드 관리 (device_id -> thread)
        self.running_threads = {}
        
        # 장치별 취소 플래그 (device_id -> threading.Event)
        self.cancel_flags = {}
        
        # 버튼 히스토리 (최대 5개까지 색상 유지)
        self.button_history = []
        self.button_colors = ['#90EE90', '#A8F5A8', '#C0FFC0', '#D8FFD8', '#F0FFF0']  # 초록색 그라데이션
        
        # UI 구성
        self.setup_ui()
        
        # 초기 장치 목록 로드
        self.refresh_devices()
        
        # JSON 설정 로드 (윈도우 크기 포함)
        self.load_commands()
    
    def setup_ui(self):
        # 상단 프레임 (장치 선택)
        top_frame = ttk.Frame(self.root, padding="10")
        top_frame.pack(fill=tk.X)
        
        ttk.Label(top_frame, text="ADB Device:").pack(side=tk.LEFT, padx=5)
        
        self.device_combo = ttk.Combobox(top_frame, width=50, state="readonly")
        self.device_combo.pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)
        
        refresh_btn = ttk.Button(top_frame, text="새로고침", command=self.refresh_devices)
        refresh_btn.pack(side=tk.LEFT, padx=5)
        
        # ADB 경로 설정 프레임
        adb_path_frame = ttk.Frame(self.root, padding="5 0 10 5")
        adb_path_frame.pack(fill=tk.X)
        
        # ADB 경로 체크박스
        adb_path_check = ttk.Checkbutton(
            adb_path_frame,
            text="ADB 실행 경로 지정",
            variable=self.use_custom_adb_path,
            command=self.toggle_adb_path
        )
        adb_path_check.pack(side=tk.LEFT, padx=5)
        
        # ADB 경로 입력 필드
        ttk.Label(adb_path_frame, text="경로:").pack(side=tk.LEFT, padx=5)
        self.adb_path_entry = ttk.Entry(adb_path_frame, width=50)
        self.adb_path_entry.insert(0, os.getcwd())
        self.adb_path_entry.pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)
        self.adb_path_entry.config(state="disabled")
        
        # 찾아보기 버튼
        self.browse_btn = ttk.Button(adb_path_frame, text="찾아보기", command=self.browse_adb_path, state="disabled")
        self.browse_btn.pack(side=tk.LEFT, padx=5)
        
        # 옵션 프레임 (순차 실행 옵션, [TESTTIME] 입력)
        option_frame = ttk.Frame(self.root, padding="5 0 10 5")
        option_frame.pack(fill=tk.X)
        
        # 순차 실행 체크박스
        sequential_check = ttk.Checkbutton(
            option_frame,
            text="All Devices 순차 실행",
            variable=self.sequential_var
        )
        sequential_check.pack(side=tk.LEFT, padx=5)
        
        # 구분선
        ttk.Separator(option_frame, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=10)
        
        # [TESTTIME] 입력 필드
        ttk.Label(option_frame, text="[TESTTIME] (초):").pack(side=tk.LEFT, padx=5)
        self.time_entry = ttk.Entry(option_frame, width=10)
        self.time_entry.insert(0, "5")
        self.time_entry.pack(side=tk.LEFT, padx=5)
        
        # 구분선
        ttk.Separator(option_frame, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=10)
        
        # 짝지을 보드 대수 입력 필드
        ttk.Label(option_frame, text="짝지을 보드 대수:").pack(side=tk.LEFT, padx=5)
        self.pair_count_entry = ttk.Entry(option_frame, width=10)
        self.pair_count_entry.insert(0, "2")
        self.pair_count_entry.pack(side=tk.LEFT, padx=5)
        
        ttk.Label(option_frame, text="(변수: [ADBID], [ADBNUM], [[ADBID]S], [TESTTIME])").pack(side=tk.LEFT, padx=5)
        
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
        
        # 마우스 휠 스크롤 지원
        def on_mousewheel(event):
            canvas.yview_scroll(int(-1*(event.delta/120)), "units")
        canvas.bind_all("<MouseWheel>", on_mousewheel)
        
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 하단 프레임 (로그 출력)
        bottom_frame = ttk.Frame(self.root, padding="10")
        bottom_frame.pack(fill=tk.BOTH, expand=True)
        
        ttk.Label(bottom_frame, text="실행 결과:").pack(anchor=tk.W)
        
        self.log_text = scrolledtext.ScrolledText(bottom_frame, height=10, wrap=tk.WORD)
        self.log_text.pack(fill=tk.BOTH, expand=True)
    
    def toggle_adb_path(self):
        """ADB 경로 체크박스 토글 시 호출"""
        if self.use_custom_adb_path.get():
            self.adb_path_entry.config(state="normal")
            self.browse_btn.config(state="normal")
        else:
            self.adb_path_entry.config(state="disabled")
            self.browse_btn.config(state="disabled")
    
    def browse_adb_path(self):
        """ADB 경로 찾아보기 다이얼로그"""
        directory = filedialog.askdirectory(
            title="ADB 실행 경로 선택",
            initialdir=self.adb_path_entry.get()
        )
        if directory:
            self.adb_path_entry.delete(0, tk.END)
            self.adb_path_entry.insert(0, directory)
    
    def get_adb_command(self, base_command: str) -> str:
        """ADB 명령어에 경로를 적용합니다."""
        if self.use_custom_adb_path.get():
            # 사용자 지정 경로 사용
            custom_path = self.adb_path_entry.get().strip()
            if custom_path:
                return f'cd /d "{custom_path}" && {base_command}'
        else:
            # 현재 Python 코드 경로 사용
            current_path = os.getcwd()
            return f'cd /d "{current_path}" && {base_command}'
        
        return base_command
    
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
            device_list = ["All Devices"] + self.devices
            self.device_combo['values'] = device_list
            
            if device_list:
                self.device_combo.current(0)
            
            self.log(f"장치 {len(self.devices)}개 발견")
            
        except FileNotFoundError:
            messagebox.showerror("오류", "ADB를 찾을 수 없습니다. ADB가 설치되어 있고 PATH에 등록되어 있는지 확인하세요.")
        except Exception as e:
            messagebox.showerror("오류", f"장치 목록 로드 실패: {str(e)}")
    
    def on_button_click(self, button, command_template):
        """버튼 클릭 시 호출되는 핸들러"""
        # 버튼 히스토리 업데이트
        if button in self.button_history:
            self.button_history.remove(button)
        self.button_history.insert(0, button)
        
        # 최대 5개까지만 유지
        if len(self.button_history) > 5:
            old_button = self.button_history.pop()
            old_button.config(bg='SystemButtonFace')
        
        # 버튼 색상 업데이트
        self.update_button_colors()
        
        # 명령 실행
        self.execute_command(command_template)
    
    def update_button_colors(self):
        """버튼 히스토리에 따라 색상 업데이트"""
        for idx, button in enumerate(self.button_history):
            if idx < len(self.button_colors):
                button.config(bg=self.button_colors[idx])
    
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
                "window": {
                    "width": 1000,
                    "height": 650
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
                                "name": "앱 목록 보기",
                                "command": "adb -s [ADBID] shell pm list packages"
                            },
                            {
                                "name": "디바이스 정보",
                                "command": "adb -s [ADBID] shell getprop"
                            }
                        ]
                    },
                    {
                        "title": "시스템 제어",
                        "commands": [
                            {
                                "name": "재부팅",
                                "command": "adb -s [ADBID] reboot"
                            },
                            {
                                "name": "화면 켜기",
                                "command": "adb -s [ADBID] shell input keyevent KEYCODE_WAKEUP"
                            },
                            {
                                "name": "배터리 정보",
                                "command": "adb -s [ADBID] shell dumpsys battery"
                            }
                        ]
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
            
            # 윈도우 크기 설정 (설정이 있으면 적용)
            if 'window' in config:
                window_config = config['window']
                width = window_config.get('width', 1000)
                height = window_config.get('height', 650)
                self.root.geometry(f"{width}x{height}")
                self.log(f"윈도우 크기 설정: {width}x{height}")
            
            columns = config.get('columns', [])
            
            # 각 열에 대한 프레임 생성
            for col_idx, column in enumerate(columns):
                # 열 프레임 생성
                col_frame = ttk.LabelFrame(
                    self.scrollable_frame,
                    text=column.get('title', f'열 {col_idx+1}'),
                    padding="10"
                )
                col_frame.grid(row=0, column=col_idx, sticky="nsew", padx=5, pady=5)
                
                # 열의 가중치 설정 (동일한 너비로 확장)
                self.scrollable_frame.grid_columnconfigure(col_idx, weight=1)
                
                # 각 명령에 대한 버튼 생성
                commands = column.get('commands', [])
                for cmd_idx, cmd_info in enumerate(commands):
                    name = cmd_info.get('name', f'명령 {cmd_idx+1}')
                    command = cmd_info.get('command', '')
                    
                    btn = tk.Button(
                        col_frame,
                        text=name,
                        command=lambda c=command, b=None: self.on_button_click(b, c),
                        relief=tk.RAISED,
                        borderwidth=2,
                        padx=10,
                        pady=5
                    )
                    # 버튼에 자기 자신을 참조하도록 설정
                    btn.config(command=lambda c=command, b=btn: self.on_button_click(b, c))
                    btn.pack(fill=tk.X, pady=2)
            
            total_commands = sum(len(col.get('commands', [])) for col in columns)
            self.log(f"{len(columns)}개 열, {total_commands}개 명령 로드 완료")
            
        except Exception as e:
            messagebox.showerror("오류", f"설정 파일 로드 실패: {str(e)}")
    
    def execute_command(self, command_template: str):
        """명령어를 실행합니다 (별도 스레드에서 실행하여 UI blocking 방지)."""
        selected = self.device_combo.get()
        
        if not selected:
            messagebox.showwarning("경고", "장치를 선택하세요.")
            return
        
        # [ADBIDS]가 포함된 명령어는 All Devices만 가능
        if "[ADBIDS]" in command_template:
            if selected != "All Devices":
                messagebox.showwarning("경고", "[ADBIDS] 변수는 'All Devices' 선택 시에만 사용 가능합니다.")
                return
        
        # [TESTTIME] 값 가져오기 (int로 변환)
        try:
            time_value = self.time_entry.get().strip()
            if not time_value:
                time_value = "0"
            time_seconds = str(int(float(time_value)))  # int로 변환
        except ValueError:
            messagebox.showerror("오류", "[TESTTIME] 값은 정수여야 합니다.")
            return
        
        # [CURTIME] 값 생성 (현재 날짜시간)
        current_time = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # 짝지을 보드 대수 가져오기
        try:
            pair_count = int(self.pair_count_entry.get().strip())
            if pair_count < 1:
                raise ValueError("짝지을 보드 대수는 1 이상이어야 합니다.")
        except ValueError as e:
            messagebox.showerror("오류", f"짝지을 보드 대수 오류: {str(e)}")
            return
        
        # 실행할 장치 목록 결정
        devices_to_run = []
        if selected == "All Devices":
            devices_to_run = [self.extract_device_id(device) for device in self.devices]
        else:
            devices_to_run = [self.extract_device_id(selected)]
        
        # 각 장치에 대해 이전 실행 중인 명령 취소
        for device_id in devices_to_run:
            if device_id in self.running_processes:
                # 이전 프로세스 종료
                self.cancel_device_command(device_id)
        
        # 별도 스레드에서 명령 실행
        thread = threading.Thread(
            target=self._execute_command_thread,
            args=(command_template, selected, time_seconds, current_time, pair_count),
            daemon=True
        )
        thread.start()
    
    def cancel_device_command(self, device_id: str):
        """특정 장치의 실행 중인 명령을 취소합니다."""
        # 취소 플래그 설정
        if device_id in self.cancel_flags:
            self.cancel_flags[device_id].set()
        
        # 실행 중인 프로세스 종료
        if device_id in self.running_processes:
            process = self.running_processes[device_id]
            try:
                process.terminate()
                process.wait(timeout=2)
            except:
                try:
                    process.kill()
                except:
                    pass
            
            self.log(f"[{device_id}] 이전 명령 취소됨", "red")
            del self.running_processes[device_id]
        
        # 스레드 정보 제거
        if device_id in self.running_threads:
            del self.running_threads[device_id]
    
    def _execute_command_thread(self, command_template: str, selected: str, time_value: str, current_time: str, pair_count: int):
        """별도 스레드에서 명령을 실행합니다."""
        # [ADBIDS] 명령어 처리
        if "[ADBIDS]" in command_template:
            # All Devices 모드에서만 실행 (이미 검증됨)
            device_ids = [self.extract_device_id(device) for device in self.devices]
            
            # 짝지을 보드 대수만큼 묶어서 실행
            commands_to_run = []
            for i in range(0, len(device_ids), pair_count):
                # pair_count 개씩 장치를 묶음
                paired_devices = device_ids[i:i+pair_count]
                
                # 실제로 묶인 장치가 있을 때만 실행
                if paired_devices:
                    # [ADBIDS]: 쉼표로 연결 (공백 없이)
                    adbids_value = ",".join(paired_devices)
                    
                    # 명령어 생성 ([ADBIDS]만 치환, [ADBID]/[ADBNUM]/[TESTTIME]은 사용 안 함)
                    cmd = (command_template
                           .replace("[ADBIDS]", adbids_value)
                           .replace("[TESTTIME]", time_value)
                           .replace("[CURTIME]", current_time))
                    
                    # ADB 경로 적용
                    cmd = self.get_adb_command(cmd)
                    
                    # 그룹 식별자 생성 (예: "device1,device2")
                    group_id = f"group_{i//pair_count + 1}_{adbids_value}"
                    commands_to_run.append((group_id, cmd, paired_devices))
            
            # 순차/동시 실행
            if self.sequential_var.get():
                self.log("\n=== 순차 실행 모드 ([ADBIDS]) ===")
                self._execute_sequential_groups(commands_to_run)
            else:
                self.log("\n=== 동시 실행 모드 ([ADBIDS]) ===")
                self._execute_parallel_groups(commands_to_run)
        else:
            # 기존 로직 ([ADBID], [ADBNUM] 사용)
            commands_to_run = []
            
            if selected == "All Devices":
                # 모든 장치에 대해 실행
                for idx, device in enumerate(self.devices):
                    device_id = self.extract_device_id(device)
                    device_num = str(idx + 1)  # 1부터 시작하는 인덱스
                    cmd = (command_template
                           .replace("[ADBID]", device_id)
                           .replace("[ADBNUM]", device_num)
                           .replace("[TESTTIME]", time_value)
                           .replace("[CURTIME]", current_time))
                    
                    # ADB 경로 적용
                    cmd = self.get_adb_command(cmd)
                    
                    commands_to_run.append((device_id, cmd))
                
                # 순차 실행 여부에 따라 실행 방식 결정
                if self.sequential_var.get():
                    self.log("\n=== 순차 실행 모드 ===")
                    self._execute_sequential(commands_to_run)
                else:
                    self.log("\n=== 동시 실행 모드 ===")
                    self._execute_parallel(commands_to_run)
            else:
                # 선택된 장치에 대해서만 실행
                device_id = self.extract_device_id(selected)
                
                # 선택된 장치의 인덱스 찾기
                device_num = "1"  # 기본값
                for idx, device in enumerate(self.devices):
                    if self.extract_device_id(device) == device_id:
                        device_num = str(idx + 1)
                        break
                
                cmd = (command_template
                       .replace("[ADBID]", device_id)
                       .replace("[ADBNUM]", device_num)
                       .replace("[TESTTIME]", time_value)
                       .replace("[CURTIME]", current_time))
                
                # ADB 경로 적용
                cmd = self.get_adb_command(cmd)
                
                commands_to_run.append((device_id, cmd))
                self._execute_sequential(commands_to_run)
    
    def _execute_sequential_groups(self, commands_to_run):
        """[[ADBID]S] 그룹 명령을 순차적으로 실행합니다."""
        for group_id, cmd, device_ids in commands_to_run:
            self.log(f"\n[그룹: {','.join(device_ids)}] 실행: {cmd}")
            
            # 그룹의 모든 장치에 대해 취소 플래그 초기화
            for device_id in device_ids:
                self.cancel_flags[device_id] = threading.Event()
            
            # 취소 확인
            cancelled = any(self.cancel_flags[device_id].is_set() for device_id in device_ids)
            if cancelled:
                self.log(f"[그룹: {','.join(device_ids)}] 실행 취소됨", "red")
                continue
            
            try:
                process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    shell=True,
                    encoding='utf-8'
                )
                
                # 프로세스 등록 (각 장치별로)
                for device_id in device_ids:
                    self.running_processes[device_id] = process
                
                # 프로세스 완료 대기 (30초 타임아웃)
                try:
                    stdout, stderr = process.communicate(timeout=30)
                    
                    # 취소 확인
                    cancelled = any(self.cancel_flags[device_id].is_set() for device_id in device_ids)
                    if cancelled:
                        self.log(f"[그룹: {','.join(device_ids)}] 실행 취소됨", "red")
                        continue
                    
                    if stdout:
                        self.log(f"[그룹: {','.join(device_ids)}] 출력:\n{stdout}")
                    if stderr:
                        self.log(f"[그룹: {','.join(device_ids)}] 에러:\n{stderr}")
                        
                except subprocess.TimeoutExpired:
                    process.kill()
                    self.log(f"[그룹: {','.join(device_ids)}] 타임아웃: 명령 실행 시간 초과")
                    
            except Exception as e:
                self.log(f"[그룹: {','.join(device_ids)}] 실행 실패: {str(e)}")
            finally:
                # 프로세스 정리
                for device_id in device_ids:
                    if device_id in self.running_processes:
                        del self.running_processes[device_id]
                    if device_id in self.cancel_flags:
                        del self.cancel_flags[device_id]
    
    def _execute_parallel_groups(self, commands_to_run):
        """[[ADBID]S] 그룹 명령을 동시에 실행합니다."""
        threads = []
        
        def run_group_command(group_id, cmd, device_ids):
            self.log(f"\n[그룹: {','.join(device_ids)}] 실행: {cmd}")
            
            # 그룹의 모든 장치에 대해 취소 플래그 초기화
            for device_id in device_ids:
                self.cancel_flags[device_id] = threading.Event()
            
            # 취소 확인
            cancelled = any(self.cancel_flags[device_id].is_set() for device_id in device_ids)
            if cancelled:
                self.log(f"[그룹: {','.join(device_ids)}] 실행 취소됨", "red")
                return
            
            try:
                process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    shell=True,
                    encoding='utf-8'
                )
                
                # 프로세스 등록
                for device_id in device_ids:
                    self.running_processes[device_id] = process
                
                # 프로세스 완료 대기
                try:
                    stdout, stderr = process.communicate(timeout=30)
                    
                    # 취소 확인
                    cancelled = any(self.cancel_flags[device_id].is_set() for device_id in device_ids)
                    if cancelled:
                        self.log(f"[그룹: {','.join(device_ids)}] 실행 취소됨", "red")
                        return
                    
                    if stdout:
                        self.log(f"[그룹: {','.join(device_ids)}] 출력:\n{stdout}")
                    if stderr:
                        self.log(f"[그룹: {','.join(device_ids)}] 에러:\n{stderr}")
                        
                except subprocess.TimeoutExpired:
                    process.kill()
                    self.log(f"[그룹: {','.join(device_ids)}] 타임아웃: 명령 실행 시간 초과")
                    
            except Exception as e:
                self.log(f"[그룹: {','.join(device_ids)}] 실행 실패: {str(e)}")
            finally:
                # 프로세스 정리
                for device_id in device_ids:
                    if device_id in self.running_processes:
                        del self.running_processes[device_id]
                    if device_id in self.cancel_flags:
                        del self.cancel_flags[device_id]
        
        # 각 그룹에 대해 별도 스레드 생성
        for group_id, cmd, device_ids in commands_to_run:
            thread = threading.Thread(target=run_group_command, args=(group_id, cmd, device_ids), daemon=True)
            threads.append(thread)
            thread.start()
        
        # 모든 스레드가 완료될 때까지 대기
        for thread in threads:
            thread.join()
        
        self.log("\n=== 모든 그룹 실행 완료 ===")
    
    def _execute_sequential(self, commands_to_run):
        """명령을 순차적으로 실행합니다."""
        for device_id, cmd in commands_to_run:
            # 취소 플래그 초기화
            self.cancel_flags[device_id] = threading.Event()
            
            # 취소 확인
            if self.cancel_flags[device_id].is_set():
                self.log(f"[{device_id}] 실행 취소됨", "red")
                continue
            
            self.log(f"\n[{device_id}] 실행: {cmd}")
            try:
                process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    shell=True,
                    encoding='utf-8'
                )
                
                # 프로세스 등록
                self.running_processes[device_id] = process
                
                # 프로세스 완료 대기 (30초 타임아웃)
                try:
                    stdout, stderr = process.communicate(timeout=30)
                    
                    # 취소 확인
                    if self.cancel_flags[device_id].is_set():
                        self.log(f"[{device_id}] 실행 취소됨", "red")
                        continue
                    
                    if stdout:
                        self.log(f"[{device_id}] 출력:\n{stdout}")
                    if stderr:
                        self.log(f"[{device_id}] 에러:\n{stderr}")
                        
                except subprocess.TimeoutExpired:
                    process.kill()
                    self.log(f"[{device_id}] 타임아웃: 명령 실행 시간 초과")
                    
            except Exception as e:
                self.log(f"[{device_id}] 실행 실패: {str(e)}")
            finally:
                # 프로세스 정리
                if device_id in self.running_processes:
                    del self.running_processes[device_id]
                if device_id in self.cancel_flags:
                    del self.cancel_flags[device_id]
    
    def _execute_parallel(self, commands_to_run):
        """명령을 동시에 실행합니다."""
        threads = []
        
        def run_command(device_id, cmd):
            # 취소 플래그 초기화
            self.cancel_flags[device_id] = threading.Event()
            
            # 취소 확인
            if self.cancel_flags[device_id].is_set():
                self.log(f"[{device_id}] 실행 취소됨", "red")
                return
            
            self.log(f"\n[{device_id}] 실행: {cmd}")
            try:
                process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    shell=True,
                    encoding='utf-8'
                )
                
                # 프로세스 등록
                self.running_processes[device_id] = process
                
                # 프로세스 완료 대기
                try:
                    stdout, stderr = process.communicate(timeout=30)
                    
                    # 취소 확인
                    if self.cancel_flags[device_id].is_set():
                        self.log(f"[{device_id}] 실행 취소됨", "red")
                        return
                    
                    if stdout:
                        self.log(f"[{device_id}] 출력:\n{stdout}")
                    if stderr:
                        self.log(f"[{device_id}] 에러:\n{stderr}")
                        
                except subprocess.TimeoutExpired:
                    process.kill()
                    self.log(f"[{device_id}] 타임아웃: 명령 실행 시간 초과")
                    
            except Exception as e:
                self.log(f"[{device_id}] 실행 실패: {str(e)}")
            finally:
                # 프로세스 정리
                if device_id in self.running_processes:
                    del self.running_processes[device_id]
                if device_id in self.cancel_flags:
                    del self.cancel_flags[device_id]
        
        # 각 장치에 대해 별도 스레드 생성
        for device_id, cmd in commands_to_run:
            thread = threading.Thread(target=run_command, args=(device_id, cmd), daemon=True)
            self.running_threads[device_id] = thread
            threads.append(thread)
            thread.start()
        
        # 모든 스레드가 완료될 때까지 대기
        for thread in threads:
            thread.join()
        
        self.log("\n=== 모든 장치 실행 완료 ===")
    
    def log(self, message: str, color: str = "black"):
        """로그 텍스트 위젯에 메시지를 추가합니다 (스레드 안전)."""
        def _update_log():
            # 색상 태그 설정
            tag_name = f"color_{color}"
            self.log_text.tag_config(tag_name, foreground=color)
            
            # 메시지 삽입
            self.log_text.insert(tk.END, message + "\n", tag_name)
            self.log_text.see(tk.END)
        
        # 메인 스레드에서 UI 업데이트
        self.root.after(0, _update_log)

def main():
    root = tk.Tk()
    app = ADBManager(root)
    root.mainloop()

if __name__ == "__main__":
    main()
