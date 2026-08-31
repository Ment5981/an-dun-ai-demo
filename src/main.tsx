import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FluentProvider, webDarkTheme } from "@fluentui/react-components";
import App from "./App";
import "./styles.css";

const andunTheme = {
  ...webDarkTheme,
  colorBrandBackground: "#d7193f",
  colorBrandBackgroundHover: "#be1435",
  colorBrandBackgroundPressed: "#a9102d",
  colorBrandForeground1: "#ef4665",
  colorBrandForeground2: "#f27087",
  colorBrandStroke1: "#ef4665",
  colorCompoundBrandForeground1: "#ef4665",
  colorCompoundBrandForeground1Hover: "#ff7188",
  colorCompoundBrandStroke: "#ef4665",
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FluentProvider theme={andunTheme} className="fluent-root">
      <App />
    </FluentProvider>
  </StrictMode>,
);
