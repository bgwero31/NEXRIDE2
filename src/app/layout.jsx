import "./globals.css";
import NexrideNativeInit from "@/components/system/NexrideNativeInit";

export const metadata = {
  title: "NEXRIDE",
  description: "Request. Negotiate. Ride.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <NexrideNativeInit />{children}</body>
    </html>
  );
}
