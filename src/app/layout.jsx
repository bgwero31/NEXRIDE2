import "./globals.css";
import NexrideNativeInit from "@/components/system/NexrideNativeInit";
import NexridePermissionGate from "@/components/system/NexridePermissionGate";

export const metadata = {
  title: "NEXRIDE",
  description: "Request. Negotiate. Ride. Track school transport.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <NexrideNativeInit />
        <NexridePermissionGate />{children}</body>
    </html>
  );
}