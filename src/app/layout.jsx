import "./globals.css";

export const metadata = {
  title: "NEXRIDE",
  description: "Request. Negotiate. Ride.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
