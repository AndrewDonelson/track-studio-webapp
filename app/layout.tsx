import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TrackStudio - Music Video Creator",
  description: "Create professional music videos with karaoke lyrics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-900 text-white flex flex-col">
          {/* Navigation */}
          <nav className="bg-gray-800 border-b border-gray-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center">
                  <Link href="/" className="flex items-center space-x-2">
                    <div className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                      TrackStudio
                    </div>
                  </Link>
                  <div className="ml-10 flex items-baseline space-x-4">
                    <Link
                      href="/songs"
                      className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition"
                    >
                      Songs
                    </Link>
                    <Link
                      href="/queue"
                      className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition"
                    >
                      Queue
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>

          {/* Footer */}
          <footer className="bg-gray-800 border-t border-gray-700 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <p className="text-center text-gray-400 text-sm">
                © 2017-2026 Nlaak Studios. All rights reserved.
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
