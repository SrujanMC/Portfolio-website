import React from "react";
import { createRoot } from "react-dom/client";
import { Sketchbook } from "@designcodeio/threeui/components/Sketchbook";
import "@designcodeio/threeui/style.css";

const mount = document.getElementById("sketchbook-root");

if (!mount) {
  throw new Error("Sketchbook mount point was not found.");
}

createRoot(mount).render(
  <Sketchbook
    assetBaseUrl="/sketchbook/"
    className="sketchbook-embed"
  />,
);
