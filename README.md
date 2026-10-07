# Crossword PWA

A modern, responsive Progressive Web Application (PWA) tailored for solving, managing, and tracking custom crossword puzzles. Built with performance, offline capability, and user experience in mind, this application delivers a native-like puzzle experience directly in the browser.

## Key Features

* **Interactive Puzzle Engine:** Features a dedicated `PlayScreen` and custom `PuzzleCard` components for a highly interactive and intuitive solving experience.
* **User Authentication & Profiles:** Secure user onboarding and session management, featuring dedicated `AuthScreen` and `ProfileScreen` interfaces.
* **Real-time Progress Tracking:** Automatically saves user progress mid-puzzle, ensuring solvers never lose their work.
* **Installable PWA:** Fully configured with a Web App Manifest and Service Worker (`sw.js`), allowing users to install the app on their mobile or desktop home screens for seamless access.
* **Polished UI/UX:** Utilizes reusable UI elements and dynamic loading screens to maintain a smooth, app-like feel during data fetching.

## Technical Choices & Architecture

This repository is structured around a modern React ecosystem, chosen specifically for developer velocity, type safety, and scalable state management.

* **Framework (Next.js App Router):** The project utilizes the Next.js `app/` directory (`layout.tsx`, `page.tsx`). This architecture was chosen to leverage React Server Components and optimized routing, providing faster initial page loads and better SEO for the web app.
* **Backend & Infrastructure (Supabase):** The application integrates Supabase for its PostgreSQL database and authentication infrastructure. This ensures a reliable, version-controlled database schema across all environments.
* **Security & Session Management:** The `lib/supabase/` directory isolates client, server, and proxy configurations to securely manage sessions and database interactions across different rendering contexts. 
* **Custom React Hooks:** Business logic is decoupled from the UI using custom hooks (`useAuth.ts`, `usePuzzles.ts`, `usePuzzleProgress.ts`). This separation of concerns ensures that the visual components remain clean and focused solely on rendering, while complex data fetching and state mutations happen behind the scenes.
* **Deployment (Vercel):** The application is deployed and hosted on Vercel, providing a highly available, edge-optimized environment suited for modern web applications.

## Project Structure

* `/app`: Next.js App Router pages and global layouts (e.g., `globals.css`, `layout.tsx`).
* `/components`: Core application interfaces like `PlayScreen.tsx`, `ProfileScreen.tsx`, and `AuthScreen.tsx`.
* `/components/ui`: Reusable, atomic design components (e.g., `button.tsx`).
* `/hooks`: Custom state management and data fetching hooks (`useAuth`, `usePuzzles`, `usePuzzleProgress`).
* `/lib`: Core utilities and the crosswords engine logic, heavily featuring the Supabase client and server setup.
* `/public`: Static assets, including PWA icons, placeholders, the Web App Manifest, and the Service Worker (`sw.js`).
* `/supabase/migrations`: Version-controlled SQL schema definitions.
