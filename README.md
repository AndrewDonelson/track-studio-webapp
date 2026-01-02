# TrackStudio WebApp

Next.js web interface for TrackStudio music video generation platform.

## Features

- Song upload and management
- Queue monitoring with real-time updates
- Album organization
- Audio analysis preview
- Video download and YouTube link access

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Query
- **API Client**: Axios

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Configuration

Create `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080/api
```

## Project Structure

- `app/` - Next.js app router pages
- `components/` - React components
- `lib/` - Utilities and API client
- `public/` - Static assets

## License

Copyright © 2026 Nlaak Studios. All rights reserved.
