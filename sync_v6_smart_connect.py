#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
智能 Git 仓库管理器 V6 (Smart Connect Edition)

新增功能:
- 解决网页版更新后本地无法同步的问题
- 在初始化时增加 "关联现有远程仓库" 选项
- 自动合并远程历史与本地文件 (Allow unrelated histories)
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

def update_gitignore(repo_path, script_name):
    gitignore_path = os.path.join(repo_path, '.gitignore')
    ignores = [script_name, ".DS_Store", "Thumbs.db", "__pycache__/", "*.log", ".venv", "venv/"]
    
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

# --- 场景一：同步现有仓库 (常规逻辑) ---

def sync_existing_repo(repo_path, script_name, custom_msg=None):
    Colors.print(f"✅ 检测到 Git 仓库，准备同步...", Colors.GREEN, bold=True)
    update_gitignore(repo_path, script_name)
    
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

# --- 场景二：初始化/关联仓库 (核心修改) ---

def init_setup(repo_path, script_name):
    Colors.print(f"🤔 未检测到 Git 仓库配置", Colors.BLUE, bold=True)
    
    print("\n请选择操作模式:")
    print("1. ✨ 创建全新的 GitHub 仓库 (并将当前文件推送上去)")
    print("2. 🔗 关联已存在的 GitHub 仓库 (下载远端代码并与本地合并)")
    
    choice = input("\n请输入序号 (1/2): ").strip()
    
    if not shutil.which('git'): 
        Colors.print("❌ 未找到 git 命令", Colors.FAIL); sys.exit(1)

    # --- 模式 1: 全新创建 (旧逻辑) ---
    if choice == '1':
        if not shutil.which('gh'):
            Colors.print("❌ 模式1需要安装 'gh' (GitHub CLI)", Colors.FAIL); sys.exit(1)
            
        repo_name = input(f"请输入新仓库名称 [{os.path.basename(repo_path)}]: ") or os.path.basename(repo_path)
        visibility = 'private' if input("可见性 (public/private) [public]: ").lower().startswith('pr') else 'public'
        
        run_command(['git', 'init', '-b', 'main'], repo_path)
        update_gitignore(repo_path, script_name)
        run_command(['git', 'add', '.'], repo_path)
        run_command(['git', 'commit', '-m', 'Initial commit'], repo_path)
        
        gh_cmd = ['gh', 'repo', 'create', repo_name, f'--{visibility}', '--source=.', '--push']
        run_command(gh_cmd, repo_path)
        Colors.print("\n=== 🎉 创建并推送成功！ ===", Colors.GREEN, bold=True)

    # --- 模式 2: 关联已有 (新逻辑) ---
    elif choice == '2':
        remote_url = input("请输入远程仓库地址 (例如 https://github.com/user/repo.git): ").strip()
        if not remote_url:
            Colors.print("❌ 地址不能为空", Colors.FAIL); sys.exit(1)

        Colors.print("\n=== 正在初始化并连接... ===", Colors.HEADER)
        run_command(['git', 'init', '-b', 'main'], repo_path)
        update_gitignore(repo_path, script_name)
        
        # 添加远程地址
        run_command(['git', 'remote', 'add', 'origin', remote_url], repo_path)
        
        # 先 Commit 本地可能存在的文件，防止 Pull 报错
        code, output = run_command(['git', 'status', '--porcelain'], repo_path, silent=True)
        if output.strip():
             run_command(['git', 'add', '.'], repo_path)
             run_command(['git', 'commit', '-m', 'Local init backup'], repo_path)

        Colors.print("\n=== 正在拉取远程代码并合并... ===", Colors.HEADER)
        # 关键点: --allow-unrelated-histories 允许把远端历史和本地历史强制合体
        pull_code, _ = run_command(['git', 'pull', 'origin', 'main', '--allow-unrelated-histories'], repo_path, check=False)
        
        if pull_code != 0:
            Colors.print("\n⚠️  拉取出现冲突，请手动打开文件解决冲突。", Colors.WARNING)
            Colors.print("解决后，请运行: git add . && git commit -m 'Merge fix' && git push", Colors.WARNING)
        else:
            Colors.print("\n=== 正在同步回远端... ===", Colors.HEADER)
            run_command(['git', 'push', '--set-upstream', 'origin', 'main'], repo_path)
            Colors.print(f"\n=== 🎉 关联成功！现在可以正常使用脚本同步了 ===", Colors.GREEN, bold=True)

    else:
        print("❌ 无效选择")
        sys.exit(1)

# --- 主程序 ---
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('message', nargs='?', help='Commit message')
    args = parser.parse_args()

    try: script_path = os.path.abspath(__file__)
    except: script_path = os.path.abspath(sys.argv[0])
    REPO_PATH = os.path.dirname(script_path)
    SCRIPT_NAME = os.path.basename(script_path)

    Colors.print(f"=== 智能 Git 管理器 V6 (Smart Connect) ===", Colors.CYAN, bold=True)
    
    if os.path.isdir(os.path.join(REPO_PATH, '.git')):
        sync_existing_repo(REPO_PATH, SCRIPT_NAME, args.message)
    else:
        init_setup(REPO_PATH, SCRIPT_NAME)

if __name__ == "__main__":
    main()