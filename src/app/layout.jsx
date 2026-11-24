import "./globals.css";
import "./nexride-design.css";
import "./ride-workspace.css";
import NexrideNativeInit from "@/components/system/NexrideNativeInit";
import NexrideSplash from "@/components/system/NexrideSplash";

export const metadata = {
  title: "NEXRIDE — Where Every Ride Feels Right",
  icons: { icon: "/nexride-mark.webp" },
  manifest: "/manifest.webmanifest",
  description: "Request. Negotiate. Ride. Track school transport.",
};

export const viewport = { themeColor: "#101827" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <NexrideNativeInit />
        
        {/* The Splash Screen renders here */}
        <NexrideSplash /> 

        {children}
      </body>
    </html>
  );
}
