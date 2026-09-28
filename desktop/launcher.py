#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""破烂王模拟器 - Windows 启动器（原生窗口版）

把自包含的网页游戏通过本地 HTTP 服务托管在本机 127.0.0.1，
优先用系统原生 WebView（Windows 上为 Edge WebView2）打开为一个独立的应用窗口；
若环境不支持原生 WebView，则回退到默认浏览器打开。

这样做让双击 exe 弹出的是「自己的窗口」，而不是浏览器标签页。
"""

import os
import sys
import socket
import threading
import http.server
import socketserver
import webbrowser

# ---------------------------------------------------------------------------
# 高分屏清晰度：声明进程 DPI 感知，避免 WebView2 被系统缩放导致界面发糊。
# 必须在创建窗口之前执行；非 Windows 平台直接跳过。
# ---------------------------------------------------------------------------
try:
    import ctypes

    if sys.platform.startswith("win"):
        try:
            ctypes.windll.shcore.SetProcessDpiAwareness(2)  # PROCESS_PER_MONITOR_DPI_AWARE
        except Exception:
            ctypes.windll.user32.SetProcessDPIAware()
except Exception:
    pass

# ---------------------------------------------------------------------------
# 资源定位：打包后资源在 sys._MEIPASS，开发时在同目录的 app/ 下
# ---------------------------------------------------------------------------
def resource_path(rel):
    if getattr(sys, "frozen", False):
        return os.path.join(sys._MEIPASS, rel)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "app", rel)


GAME_FILE = "index.html"
EXIT_PATH = "/__exit__"


# ---------------------------------------------------------------------------
# 仅本机可访问的静态服务（游戏全内联，无需任何外部文件）
# ---------------------------------------------------------------------------
class Handler(http.server.BaseHTTPRequestHandler):
    html = b""

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == EXIT_PATH:
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"bye")
            threading.Thread(target=_delayed_exit, daemon=True).start()
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(Handler.html)

    def log_message(self, *args):  # 静默日志
        pass


def _delayed_exit():
    import time
    time.sleep(0.3)
    os._exit(0)


# 固定端口：localStorage 按「协议 + 域名 + 端口」隔离，端口一旦漂移，旧存档就读不回来。
# 因此必须固定端口，保证每次启动 origin 一致。
FIXED_PORT = 8765


class Server(socketserver.TCPServer):
    allow_reuse_address = True   # 上次硬退出后的 TIME_WAIT 不阻塞重启


def profile_dir():
    """WebView2 持久化目录（private_mode=False 时 localStorage 落盘到这里）。"""
    base = os.environ.get("LOCALAPPDATA") or os.path.join(os.path.expanduser("~"), "AppData", "Local")
    d = os.path.join(base, "WasteStationJournal", "profile")
    try:
        os.makedirs(d, exist_ok=True)
    except Exception:
        pass
    return d


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------
def main():
    with open(resource_path(GAME_FILE), "rb") as f:
        data = f.read()

    # 关闭监听：回退到浏览器时使用（关页面即退出），原生窗口靠窗口关闭事件退出
    inject = (
        b"<script>window.addEventListener('pagehide',function(){"
        b"navigator.sendBeacon(location.origin+'/__exit__');});"
        b"window.addEventListener('beforeunload',function(){"
        b"navigator.sendBeacon(location.origin+'/__exit__');});</script>"
    )
    if b"</body>" in data:
        data = data.replace(b"</body>", inject + b"</body>", 1)
    else:
        data = data + inject
    Handler.html = data

    try:
        httpd = Server(("127.0.0.1", FIXED_PORT), Handler)
    except OSError:
        # 端口被占：大概率上一个游戏实例还在运行，把系统浏览器引过去复用即可
        try:
            webbrowser.open(f"http://127.0.0.1:{FIXED_PORT}/")
        except Exception:
            pass
        return
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{FIXED_PORT}/"

    # 1) 优先：原生 WebView 窗口（不带浏览器外壳）
    try:
        import webview

        webview.create_window(
            "破烂王模拟器",
            url=url,
            width=1000,
            height=760,
            resizable=True,
            min_size=(360, 640),
        )
        webview.start(private_mode=False, storage_path=profile_dir())
        httpd.shutdown()
        sys.exit(0)
    except Exception as exc:  # noqa: BLE001 - 任何异常都回退
        sys.stderr.write(f"[提示] 原生窗口不可用，回退到浏览器：{exc}\n")

    # 2) 回退：默认浏览器
    try:
        webbrowser.open(url)
    except Exception:
        pass
    print(f"破烂王模拟器运行中：{url}（关闭页面即退出）")
    try:
        while True:
            threading.Event().wait(1)
    except (KeyboardInterrupt, SystemExit):
        pass
    finally:
        httpd.shutdown()


if __name__ == "__main__":
    main()
