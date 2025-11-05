# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/5cf44e6a-09fd-4abb-90a8-7fcec741c7ee

## How can I edit this code?

There are several ways of editing your application.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/5cf44e6a-09fd-4abb-90a8-7fcec741c7ee) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Environment setup (Realtime vehicle tracking)

Add these variables to a `.env` file in the project root, then restart the dev server.

```
# Optional custom WebSocket provider
# Must accept ?vehicle=WP-CAB-1234 and emit { lat, lng, timestamp }
VITE_VEHICLE_WS_URL=

# Traccar (open-source GPS server) WebSocket endpoint
# Use wss in production, path is /api/socket
VITE_TRACCAR_WS_URL=wss://your-traccar-domain/api/socket

# Traccar Access Token (create in Traccar UI: Settings → Preferences → Tokens)
VITE_TRACCAR_TOKEN=your_traccar_access_token
```
