import type { Metadata } from "next";
import ApplicationNotifications from "@/components/ApplicationNotifications";
import PentecostChatbot from "@/components/PentecostChatbot";
import ThemeToggle from "@/components/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pentecost University Recruitment",
  description: "Recruitment workflow, CV review, interview scheduling, and hiring approvals for Pentecost University.",
  icons: {
    icon: "https://pentvars.edu.gh/wp-content/themes/eduma-child/images/pentecost-university-logo-alt.png",
    shortcut: "https://pentvars.edu.gh/wp-content/themes/eduma-child/images/pentecost-university-logo-alt.png",
    apple: "https://pentvars.edu.gh/wp-content/themes/eduma-child/images/pentecost-university-logo-alt.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <ApplicationNotifications />
        <PentecostChatbot />
        <ThemeToggle />
      </body>
    </html>
  );
}
