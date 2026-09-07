import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import App from "./App";
import "./styles.css";
import "./design.css";

const andunTheme = {
  ...webLightTheme,
  fontFamilyBase: '"Source Han Sans SC", sans-serif',
  fontSizeBase200: "14px",
  fontSizeBase300: "16px",
  fontSizeBase400: "18px",
  lineHeightBase300: "24px",
  colorBrandBackground: "#2563eb",
  colorBrandBackgroundHover: "#1d4ed8",
  colorBrandBackgroundPressed: "#1e40af",
  colorBrandForeground1: "#1d4ed8",
  colorBrandForeground2: "#1d4ed8",
  colorBrandStroke1: "#2563eb",
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FluentProvider theme={andunTheme} className="fluent-root">
      <App />
    </FluentProvider>
  </StrictMode>,
);
