import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./paid.css";

export const metadata: Metadata = {
  title: {
    default: "Noctua Pay",
    template: "%s · Noctua Pay",
  },
  description:
    "Noctua Pay — the customer billing portal for Noctua's SMB clients. Get paid in full today; let your customers pay over time.",
  icons: { icon: "/owl-mark.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
