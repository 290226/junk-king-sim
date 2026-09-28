#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""本地构建 Windows 可执行文件（原生窗口版）。

依赖：pip install -r requirements.txt
产出：dist/破烂王模拟器.exe （单文件，自带游戏、Python 运行环境与 Edge WebView2 原生窗口支持）

用法：python build_exe.py
"""
import os
import PyInstaller.__main__

import webview  # 用于定位其原生库目录，确保一并打入

HERE = os.path.dirname(os.path.abspath(__file__))
ICON = os.path.join(HERE, "build", "icon.ico")
GAME = os.path.join(HERE, "app", "index.html")

if not os.path.exists(GAME):
    raise SystemExit("找不到 app/index.html，请确认游戏本体已就位。")

wv_dir = os.path.dirname(webview.__file__)
lib_src = os.path.join(wv_dir, "lib")      # WebView2 / WinForms 互操作原生库
js_src = os.path.join(wv_dir, "js")        # pywebview 注入脚本

cmd = [
    os.path.join(HERE, "launcher.py"),
    "--noconsole",
    "--onefile",
    "--name", "破烂王模拟器",
    # 游戏本体
    "--add-data", GAME + os.pathsep + ".",
    # pywebview 原生库与脚本（官方 PyInstaller 钩子也会收集，这里显式再收集一次更稳妥）
    "--add-data", lib_src + os.pathsep + "webview/lib",
    "--add-data", js_src + os.pathsep + "webview/js",
    # 原生窗口后端依赖
    "--hidden-import", "clr",
    "--hidden-import", "pythonnet",
    "--collect-submodules", "pythonnet",
    "--distpath", os.path.join(HERE, "dist"),
    "--workpath", os.path.join(HERE, "build", "work"),
    "--specpath", os.path.join(HERE, "build"),
]
if os.path.exists(ICON):
    cmd += ["--icon", ICON]

PyInstaller.__main__.run(cmd)
print("构建完成，产物位于 dist/ 目录。")
