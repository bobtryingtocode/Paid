import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Cadence",
  description: "Get the maker paid now. Let the business repay as it sells.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          margin: 0,
          color: "#111",
          background: "#fafafa",
        }}
      >
        {children}
      </body>
    </html>
  );
}
