import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./paid.css";

export const metadata: Metadata = {
  title: "Paid.",
  description: "Get paid. Let them pay over time.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
