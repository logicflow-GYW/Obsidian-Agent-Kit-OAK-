#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
智能 Git 仓库管理器 V7 (Stealth Edition)

核心修复:
- 彻底解决 "脚本把自己推送到仓库" 的问题。
- 运行脚本时，会自动检测并从 Git 索引中移除脚本自身 (git rm --cached)。
- 效果: 脚本保留在本地，但在 GitHub 仓库中消失。
"""

import subprocess
import os
import sys
import datetime
import shutil
import argparse

# --- 🎨 终端颜色类 ---
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

    @staticmethod
    def print(msg, color=ENDC, bold=False):
        prefix = ""
        if bold: prefix += Colors.BOLD
        print(f"{prefix}{color}{msg}{Colors.ENDC}")

# --- 核心辅助函数 ---

def run_command(command, repo_path, check=True, silent=False):
    if not silent:
        # 只有非 git status 命令才打印，减少刷屏
        if 'status' not in command:
            print(f"{Colors.CYAN}▶️  Exec: {' '.join(command)}{Colors.ENDC}")
    
    try:
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            cwd=repo_path,
            bufsize=1,
            encoding='utf-8'
        )
        
        output_lines = []
        for line in process.stdout:
            if not silent: print(line, end='', flush=True)
            output_lines.append(line)
            
        process.wait()
        
        if check and process.returncode != 0:
            raise subprocess.CalledProcessError(process.returncode, command, output=''.join(output_lines))
            
        return process.returncode, "".join(output_lines)
        
    except Exception as e:
        if not silent: Colors.print(f"\n❌ 执行失败: {e}", Colors.FAIL)
        if check: sys.exit(1)
        return -1, str(e)

def ensure_self_is_hidden(repo_path, script_name):
    """ 
    核心修复逻辑:
    1. 确保在 .gitignore 中
    2. 确保从 Git 索引中移除 (Untrack)
    """
    gitignore_path = os.path.join(repo_path, '.gitignore')
    ignores = [script_name, ".DS_Store", "Thumbs.db", "__pycache__/", "*.log", ".venv", "venv/"]
    
    # 1. 更新 .gitignore
    current_content = ""
    if os.path.exists(gitignore_path):
        with open(gitignore_path, 'r', encoding='utf-8') as f:
            current_content = f.read()
            
    missing = [i for i in ignores if i not in current_content]
    if missing:
        try:
            with open(gitignore_path, 'a', encoding='utf-8') as f:
                if current_content and not current_content.endswith('\n'): f.write('\n')
                f.write("\n# Auto-added by Sync Script\n" + "\n".join(missing) + "\n")
            Colors.print(f"🔧 .gitignore 已更新。", Colors.WARNING)
        except: pass

    # 2. 强制从 Git 索引移除 (如果之前误传过)
    # 检查文件是否被 Git 跟踪
    code, output = run_command(['git', 'ls-files', script_name], repo_path, silent=True)
    if output.strip() == script_name:
        Colors.print(f"🕵️  检测到脚本被 Git 跟踪，正在强制移除...", Colors.WARNING)
        # git rm --cached 只删索引，不删本地文件
        run_command(['git', 'rm', '--cached', script_name], repo_path, silent=True)
        Colors.print(f"✅ 脚本已进入隐身模式 (将从下次提交中消失)", Colors.GREEN)

# --- 场景一：同步现有仓库 ---

def sync_existing_repo(repo_path, script_name, custom_msg=None):
    Colors.print(f"✅ 检测到 Git 仓库，准备同步...", Colors.GREEN, bold=True)
    
    # 先执行隐身操作！
    ensure_self_is_hidden(repo_path, script_name)
    
    # 1. Add & Commit
    code, output = run_command(['git', 'status', '--porcelain'], repo_path, silent=True)
    if output.strip():
        Colors.print("\n=== 1. 提交本地变更 ===", Colors.HEADER)
        run_command(['git', 'add', '.'], repo_path)
        
        msg = custom_msg if custom_msg else f"Sync: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        run_command(['git', 'commit', '-m', msg], repo_path)
    else:
        Colors.print("\n=== 1. 本地无变更，跳过提交 ===", Colors.BLUE)

    # 2. Pull
    Colors.print("\n=== 2. 拉取更新 (Rebase) ===", Colors.HEADER)
    code, _ = run_command(['git', 'pull', '--rebase', '--autostash'], repo_path, check=False)
    if code != 0:
        Colors.print("\n❌ PULL 冲突，请手动解决。", Colors.FAIL)
        sys.exit(1)

    # 3. Push
    Colors.print("\n=== 3. 推送 ===", Colors.HEADER)
    branch_code, current_branch = run_command(['git', 'branch', '--show-current'], repo_path, silent=True)
    current_branch = current_branch.strip()
    
    code, output = run_command(['git', 'push'], repo_path, check=False)
    if code != 0 and "set-upstream" in output:
        Colors.print(f"⚠️ 首次推送，自动设置上游...", Colors.WARNING)
        run_command(['git', 'push', '--set-upstream', 'origin', current_branch], repo_path)
    
    Colors.print(f"\n=== 🎉 同步完成！ ===", Colors.GREEN, bold=True)

# --- 场景二：初始化/关联仓库 ---

def init_setup(repo_path, script_name):
    Colors.print(f"🤔 未检测到 Git 仓库配置", Colors.BLUE, bold=True)
    
    print("\n请选择操作模式:")
    print("1. ✨ 创建全新的 GitHub 仓库")
    print("2. 🔗 关联已存在的 GitHub 仓库")
    
    choice = input("\n请输入序号 (1/2): ").strip()
    if not shutil.which('git'): Colors.print("❌ 未找到 git", Colors.FAIL); sys.exit(1)

    if choice == '1': # 新建
        repo_name = input(f"新仓库名称 [{os.path.basename(repo_path)}]: ") or os.path.basename(repo_path)
        visibility = 'private' if input("可见性 (public/private) [public]: ").lower().startswith('pr') else 'public'
        
        run_command(['git', 'init', '-b', 'main'], repo_path)
        ensure_self_is_hidden(repo_path, script_name) # 隐身
        run_command(['git', 'add', '.'], repo_path)
        run_command(['git', 'commit', '-m', 'Initial commit'], repo_path)
        
        gh_cmd = ['gh', 'repo', 'create', repo_name, f'--{visibility}', '--source=.', '--push']
        run_command(gh_cmd, repo_path)

    elif choice == '2': # 关联
        remote_url = input("远程仓库地址: ").strip()
        if not remote_url: sys.exit(1)

        Colors.print("\n=== 初始化连接 ===", Colors.HEADER)
        run_command(['git', 'init', '-b', 'main'], repo_path)
        ensure_self_is_hidden(repo_path, script_name) # 隐身
        
        run_command(['git', 'remote', 'add', 'origin', remote_url], repo_path)
        
        # 先提交本地现有文件（除了脚本自己）
        code, output = run_command(['git', 'status', '--porcelain'], repo_path, silent=True)
        if output.strip():
             run_command(['git', 'add', '.'], repo_path)
             run_command(['git', 'commit', '-m', 'Local init backup'], repo_path)

        Colors.print("\n=== 合并远程代码 ===", Colors.HEADER)
        run_command(['git', 'pull', 'origin', 'main', '--allow-unrelated-histories'], repo_path, check=False)
        
        Colors.print("\n=== 同步回远端 ===", Colors.HEADER)
        run_command(['git', 'push', '--set-upstream', 'origin', 'main'], repo_path)
        Colors.print(f"\n=== 🎉 关联成功！ ===", Colors.GREEN, bold=True)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('message', nargs='?', help='Commit message')
    args = parser.parse_args()

    try: script_path = os.path.abspath(__file__)
    except: script_path = os.path.abspath(sys.argv[0])
    REPO_PATH = os.path.dirname(script_path)
    SCRIPT_NAME = os.path.basename(script_path)

    Colors.print(f"=== 智能 Git 管理器 V7 (Stealth) ===", Colors.CYAN, bold=True)
    
    if os.path.isdir(os.path.join(REPO_PATH, '.git')):
        sync_existing_repo(REPO_PATH, SCRIPT_NAME, args.message)
    else:
        init_setup(REPO_PATH, SCRIPT_NAME)

if __name__ == "__main__":
    main()