"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("BlueDeck global render error", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "linear-gradient(145deg, #eef6fb 0%, #ffffff 52%, #e6f5f8 100%)",
          color: "#071631",
          fontFamily: 'Inter, "Avenir Next", "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <title>BlueDeck | Something went wrong</title>
        <main
          style={{
            display: "grid",
            minHeight: "100dvh",
            placeItems: "center",
            padding: "32px",
          }}
        >
          <section
            style={{
              width: "min(100%, 640px)",
              border: "1px solid rgba(7, 22, 49, 0.12)",
              borderRadius: "28px",
              background: "rgba(255, 255, 255, 0.96)",
              padding: "clamp(28px, 6vw, 56px)",
              boxShadow: "0 28px 80px rgba(7, 22, 49, 0.12)",
            }}
          >
            <p
              style={{
                margin: 0,
                color: "#0e7490",
                fontSize: "12px",
                fontWeight: 800,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              BlueDeck
            </p>
            <h1 style={{ margin: "18px 0 0", fontSize: "clamp(36px, 7vw, 58px)", lineHeight: 1.05 }}>
              BlueDeck could not open.
            </h1>
            <p lang="tr" style={{ margin: "10px 0 0", color: "#40566f", fontSize: "18px", fontWeight: 700 }}>
              BlueDeck açılamadı.
            </p>
            <p style={{ margin: "24px 0 0", color: "#5b7088", fontSize: "16px", lineHeight: 1.7 }}>
              A temporary problem interrupted this page. You can try again now or return to the homepage.
              <br />
              <span lang="tr">Geçici bir sorun sayfayı durdurdu. Şimdi tekrar deneyebilir veya ana sayfaya dönebilirsiniz.</span>
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "30px" }}>
              <button
                type="button"
                onClick={() => unstable_retry()}
                style={{
                  minHeight: "48px",
                  border: 0,
                  borderRadius: "14px",
                  background: "#071631",
                  padding: "12px 22px",
                  color: "#ffffff",
                  cursor: "pointer",
                  font: "800 15px/1.2 inherit",
                }}
              >
                Try again / Tekrar dene
              </button>
              <Link
                href="/"
                style={{
                  display: "inline-flex",
                  minHeight: "46px",
                  alignItems: "center",
                  border: "1px solid rgba(7, 22, 49, 0.18)",
                  borderRadius: "14px",
                  padding: "0 22px",
                  color: "#071631",
                  fontSize: "15px",
                  fontWeight: 800,
                  textDecoration: "none",
                }}
              >
                Return home / Ana sayfaya dön
              </Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
