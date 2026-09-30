#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""本地构建 Windows 可执行文件（原生窗口版）。

依赖：pip install -r requirements.txt
产出：dist/破烂王模拟器/ 目录（onedir 文件夹版，自带游戏、Python 运行环境与 Edge WebView2 原生窗口支持）
说明：onedir 模式可显著降低杀毒软件（尤其 Windows Defender）对 PyInstaller 单文件自解压行为的误报。

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
    "--onedir",
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

# 构建完成后，把 onedir 文件夹打成 zip（保持顶层文件夹结构），方便分发并降低杀软误报
import zipfile

ZIP_NAME = "JunkKingSim-win64.zip"
_src_dir = os.path.join(HERE, "dist", "破烂王模拟器")
_zip_path = os.path.join(HERE, "dist", ZIP_NAME)
if os.path.isdir(_src_dir):
    with zipfile.ZipFile(_zip_path, "w", zipfile.ZIP_DEFLATED) as _z:
        for _root, _dirs, _files in os.walk(_src_dir):
            for _fn in _files:
                _full = os.path.join(_root, _fn)
                _z.write(_full, os.path.relpath(_full, os.path.join(HERE, "dist")))
    print("已打包 zip：", _zip_path)

print("构建完成，产物位于 dist/ 目录。")
