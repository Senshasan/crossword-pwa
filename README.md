# Crossword PWA

A modern, responsive Progressive Web Application (PWA) tailored for solving, managing, and tracking custom crossword puzzles[cite: 1]. Built with performance, offline capability, and user experience in mind, this application delivers a native-like puzzle experience directly in the browser[cite: 1].

## Key Features

* **Interactive Puzzle Engine:** Features a dedicated `PlayScreen` and custom `PuzzleCard` components for a highly interactive and intuitive solving experience[cite: 1].
* **User Authentication & Profiles:** Secure user onboarding and session management, featuring dedicated `AuthScreen` and `ProfileScreen` interfaces[cite: 1].
* **Real-time Progress Tracking:** Automatically saves user progress mid-puzzle, ensuring solvers never lose their work[cite: 1].
* **Installable PWA:** Fully configured with a Web App Manifest and Service Worker (`sw.js`), allowing users to install the app on their mobile or desktop home screens for seamless access[cite: 1].
* **Polished UI/UX:** Utilizes reusable UI elements and dynamic loading screens to maintain a smooth, app-like feel during data fetching[cite: 1].

## Technical Choices & Architecture

This repository is structured around a modern React ecosystem, chosen specifically for developer velocity, type safety, and scalable state management[cite: 1].

* **Framework (Next.js App Router):** The project utilizes the Next.js `app/` directory (`layout.tsx`, `page.tsx`)[cite: 1]. This architecture was chosen to leverage React Server Components and optimized routing, providing faster initial page loads and better SEO for the web app[cite: 1].
* **Backend & Infrastructure (Supabase):** The application integrates Supabase for its PostgreSQL database and authentication infrastructure[cite: 1]. This ensures a reliable, version-controlled database schema across all environments.
* **Security & Session Management:** The `lib/supabase/` directory isolates client, server, and proxy configurations to securely manage sessions and database interactions across different rendering contexts[cite: 1]. 
* **Custom React Hooks:** Business logic is decoupled from the UI using custom hooks (`useAuth.ts`, `usePuzzles.ts`, `usePuzzleProgress.ts`)[cite: 1]. This separation of concerns ensures that the visual components remain clean and focused solely on rendering, while complex data fetching and state mutations happen behind the scenes[cite: 1].
* **Deployment (Vercel):** The application is deployed and hosted on Vercel, providing a highly available, edge-optimized environment suited for modern web applications.

## Project Structure

* `/app`: Next.js App Router pages and global layouts (e.g., `globals.css`, `layout.tsx`)[cite: 1].
* `/components`: Core application interfaces like `PlayScreen.tsx`, `ProfileScreen.tsx`, and `AuthScreen.tsx`[cite: 1].
* `/components/ui`: Reusable, atomic design components (e.g., `button.tsx`)[cite: 1].
* `/hooks`: Custom state management and data fetching hooks (`useAuth`, `usePuzzles`, `usePuzzleProgress`)[cite: 1].
* `/lib`: Core utilities and the crosswords engine logic, heavily featuring the Supabase client and server setup[cite: 1].
* `/public`: Static assets, including PWA icons, placeholders, the Web App Manifest, and the Service Worker (`sw.js`)[cite: 1].
* `/supabase/migrations`: Version-controlled SQL schema definitions[cite: 1].
