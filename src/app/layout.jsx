import "./globals.css";
import NexrideNativeInit from "@/components/system/NexrideNativeInit";
import NexridePermissionGate from "@/components/system/NexridePermissionGate";
import NexrideSplash from "@/components/system/NexrideSplash"; // <-- ADD THIS

export const metadata = {
  title: "NEXRIDE — Move Better",
  description: "Request. Negotiate. Ride. Track school transport.",
  icons: {
    icon: "/favicon.svg",
    apple: "/nexride-icon.svg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <NexrideNativeInit />
        <NexridePermissionGate />
        
        {/* SPLASH SCREEN */}
        <NexrideSplash />

        {children}
      </body>
    </html>
  );
}
