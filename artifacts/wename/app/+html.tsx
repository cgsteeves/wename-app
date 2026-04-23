import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <ScrollViewStyleReset />
        {/* Override Expo's full-viewport defaults to show a phone-sized frame */}
        <style dangerouslySetInnerHTML={{ __html: webStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const webStyles = `
  html {
    height: 100%;
  }

  body {
    margin: 0 !important;
    padding: 0 !important;
    height: auto !important;
    min-height: 100vh;
    overflow: auto !important;
    display: flex !important;
    justify-content: center;
    align-items: flex-start;
    background-color: #c8bfb0;
    background-image: radial-gradient(circle at 60% 40%, #d4c9b8 0%, #b8ad9e 100%);
  }

  #root {
    flex: none !important;
    width: 100% !important;
    max-width: 390px !important;
    height: auto !important;
    min-height: 100vh;
    background-color: #f9f1de;
    overflow: hidden;
    box-shadow:
      0 0 0 1px rgba(0,0,0,0.10),
      0 8px 24px rgba(0,0,0,0.14),
      0 32px 80px rgba(0,0,0,0.18);
  }
`;
