import "./globals.css";
import NexrideNativeInit from "@/components/system/NexrideNativeInit";
import NexridePermissionGate from "@/components/system/NexridePermissionGate";
import NexrideSplash from "@/components/system/NexrideSplash"; // <-- Import it here

export const metadata = {
  title: "NEXRIDE — Where Every Ride Feels Right",
  description: "Request. Negotiate. Ride. Track school transport.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <NexrideNativeInit />
        <NexridePermissionGate />
        
        {/* The Splash Screen renders here */}
        <NexrideSplash /> 

        {children}
      </body>
    </html>
  );
}
