import React from "react";
import { createRoot } from "react-dom/client";
import { KoiStudies } from "@designcodeio/threeui/components/KoiStudies";

const mount = document.getElementById("koi-studies-root");

if (!mount) {
  throw new Error("Koi Studies mount point was not found.");
}

function KoiPointerBridge() {
  React.useEffect(() => {
    const iframe = mount.querySelector("iframe");

    if (!iframe) {
      throw new Error("Koi Studies iframe was not found.");
    }

    let drag = null;

    const handlePointerDown = (event) => {
      if (event.target !== iframe || !event.isPrimary || event.button !== 0) {
        return;
      }

      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
      };
    };

    const handlePointerUp = (event) => {
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }

      const { startX, startY } = drag;
      drag = null;

      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      const distance = Math.hypot(deltaX, deltaY);
      const threshold = Math.min(88, Math.max(52, iframe.clientWidth * 0.18));
      let direction = 0;

      if (distance <= 10) {
        direction = 1;
      } else if (
        Math.abs(deltaX) >= threshold &&
        Math.abs(deltaX) >= Math.abs(deltaY) * 0.75
      ) {
        direction = deltaX < 0 ? 1 : -1;
      }

      if (direction) {
        iframe.contentWindow?.postMessage(
          { type: "sylva:koi-drag", direction },
          "*",
        );
      }

    };

    const cancelPointer = (event) => {
      if (!drag || (event.pointerId !== undefined && event.pointerId !== drag.pointerId)) {
        return;
      }

      drag = null;
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("pointerup", handlePointerUp, true);
    document.addEventListener("pointercancel", cancelPointer, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("pointerup", handlePointerUp, true);
      document.removeEventListener("pointercancel", cancelPointer, true);
    };
  }, []);

  return null;
}

createRoot(mount).render(
  <>
    <KoiStudies
      className="koi-studies-embed"
      style={{ width: "100%", height: "100%", minWidth: 0, minHeight: 0 }}
    />
    <KoiPointerBridge />
  </>,
);
