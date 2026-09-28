/* eslint-disable @next/next/no-img-element -- icon app nhỏ */
"use client";

import { useEffect, useState } from "react";
import { Modal } from "./Modal";

// Sự kiện Chrome/Edge (Android, desktop) bắn ra khi app đủ điều kiện cài PWA.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "sweetshop.install.dismissed";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/**
 * Nút "Cài app về điện thoại" (PWA).
 * - Android/Chrome: gọi hộp thoại cài đặt gốc.
 * - iPhone/iPad (Safari không hỗ trợ cài tự động): hiện hướng dẫn "Chia sẻ → Thêm vào MH chính".
 * - Đã mở từ app đã cài → không hiện.
 * variant="banner": thẻ có nút đóng (ẩn luôn sau khi đóng); variant="button": nút thường.
 */
export function InstallAppButton({ variant = "button" }: { variant?: "button" | "banner" }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<"hidden" | "prompt" | "ios">("hidden");
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (variant === "banner") {
      try {
        if (localStorage.getItem(DISMISS_KEY)) return;
      } catch {}
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("prompt");
    };
    const onInstalled = () => setMode("hidden");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    // iOS không có beforeinstallprompt → hiện nút hướng dẫn.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isIos()) setMode("ios");
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [variant]);

  async function install() {
    if (mode === "ios") return setShowIosHelp(true);
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setMode("hidden");
    setDeferred(null);
  }

  function dismiss() {
    setMode("hidden");
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  }

  if (mode === "hidden") return null;

  const button = (
    <button type="button" className="btn btn--primary btn--sm" onClick={install}>
      <PhoneIcon /> Cài app
    </button>
  );

  return (
    <>
      {variant === "banner" ? (
        <div className="card row" style={{ gap: 10, background: "#fff3e2", boxShadow: "none", border: "2px solid var(--border)" }}>
          <img src="/icons/icon-192.png" alt="" width={40} height={40} style={{ borderRadius: 10 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ display: "block" }}>Cài Sweet Shop về điện thoại</strong>
            <span className="small muted" style={{ fontWeight: 700 }}>
              Mở nhanh từ màn hình chính, toàn màn hình như app
            </span>
          </div>
          {button}
          <button type="button" className="icon-btn" style={{ width: 32, height: 32, boxShadow: "none" }} onClick={dismiss} aria-label="Ẩn gợi ý cài app">
            ×
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn--soft btn--block" onClick={install}>
          <PhoneIcon /> Cài app về điện thoại
        </button>
      )}

      {showIosHelp && (
        <Modal title="Thêm Sweet Shop vào màn hình chính" onClose={() => setShowIosHelp(false)}>
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9, fontWeight: 700 }}>
            <li>
              Mở trang này bằng <strong>Safari</strong>.
            </li>
            <li>
              Bấm nút <strong>Chia sẻ</strong> <ShareIcon /> ở thanh dưới cùng.
            </li>
            <li>
              Kéo xuống, chọn <strong>Thêm vào MH chính</strong> (Add to Home Screen).
            </li>
            <li>
              Bấm <strong>Thêm</strong> — biểu tượng tiệm bánh sẽ xuất hiện trên màn hình.
            </li>
          </ol>
          <button type="button" className="btn btn--primary btn--block" onClick={() => setShowIosHelp(false)}>
            Đã hiểu
          </button>
        </Modal>
      )}
    </>
  );
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="6" y="2" width="12" height="20" rx="3" />
      <path d="M12 7v7m-3-3 3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ verticalAlign: "-3px" }}>
      <path d="M12 3v12M8 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" strokeLinecap="round" />
    </svg>
  );
}
