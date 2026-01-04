import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Welcome to TrackStudio</h1>
        <p className="text-gray-400 text-lg">
          Create professional music videos with karaoke lyrics and stereo visualizers
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Songs Card */}
        <Link
          href="/songs"
          className="block p-6 bg-gray-800 rounded-lg border border-gray-700 hover:border-blue-500 transition group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="text-3xl">🎵</div>
            <div className="text-blue-500 group-hover:translate-x-1 transition">→</div>
          </div>
          <h2 className="text-2xl font-semibold mb-2">Songs</h2>
          <p className="text-gray-400">
            Manage your song library, edit lyrics, and configure visualization settings
          </p>
        </Link>

        {/* Queue Card */}
        <Link
          href="/queue"
          className="block p-6 bg-gray-800 rounded-lg border border-gray-700 hover:border-purple-500 transition group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="text-3xl">⚡</div>
            <div className="text-purple-500 group-hover:translate-x-1 transition">→</div>
          </div>
          <h2 className="text-2xl font-semibold mb-2">Queue</h2>
          <p className="text-gray-400">
            Monitor video rendering progress and manage the processing queue
          </p>
        </Link>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h3 className="text-xl font-semibold mb-4">Features</h3>
        <ul className="space-y-3 text-gray-300">
          <li className="flex items-start">
            <span className="text-blue-500 mr-3">✓</span>
            <span>Stereo audio visualization with bars on left and right edges</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-3">✓</span>
            <span>Word-level karaoke subtitles with synchronized highlighting</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-3">✓</span>
            <span>Custom background images for different song sections</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-3">✓</span>
            <span>Real-time progress monitoring during video rendering</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
