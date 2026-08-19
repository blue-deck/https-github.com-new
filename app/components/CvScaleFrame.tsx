"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const cvDesignWidth = 980;

export function CvScaleFrame({
  children,
  responsiveOnMobile = false,
}: {
  children: ReactNode;
  responsiveOnMobile?: boolean;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    function updateFrame() {
      const frame = frameRef.current;
      const content = contentRef.current;
      if (!frame || !content) return;

      if (
        responsiveOnMobile &&
        window.matchMedia("screen and (max-width: 900px)").matches
      ) {
        setScale(1);
        setHeight(null);
        return;
      }

      const frameStyle = window.getComputedStyle(frame);
      const horizontalPadding = parseFloat(frameStyle.paddingLeft) + parseFloat(frameStyle.paddingRight);
      const verticalPadding = parseFloat(frameStyle.paddingTop) + parseFloat(frameStyle.paddingBottom);
      const availableWidth = Math.max(1, frame.clientWidth - horizontalPadding);
      const nextScale = Math.min(1, availableWidth / cvDesignWidth);
      const contentHeight = content.scrollHeight || content.getBoundingClientRect().height || 1120;

      setScale(nextScale);
      setHeight(Math.ceil(contentHeight * nextScale + verticalPadding));
    }

    updateFrame();

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateFrame) : null;
    if (resizeObserver && frameRef.current) resizeObserver.observe(frameRef.current);
    if (resizeObserver && contentRef.current) resizeObserver.observe(contentRef.current);

    window.addEventListener("resize", updateFrame);
    window.addEventListener("orientationchange", updateFrame);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateFrame);
      window.removeEventListener("orientationchange", updateFrame);
    };
  }, [responsiveOnMobile]);

  return (
    <div
      ref={frameRef}
      className={`bd-cv-scale-wrap bg-[#f3f7f8] p-3 sm:p-5 print:p-0 ${
        responsiveOnMobile ? "bd-cv-scale-wrap-mobile-readable" : ""
      }`}
      style={{ height: height ? `${height}px` : undefined }}
    >
      <div
        ref={contentRef}
        className="bd-cv-scale-content"
        style={{
          width: `${cvDesignWidth}px`,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}
