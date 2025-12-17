# gentryriggen.com

Personal website built with Next.js, TypeScript, and Tailwind CSS.

## Tech Stack

- **Framework**: Next.js 16+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Testing**: Jest + React Testing Library + Playwright
- **Deployment**: Firebase Hosting
- **CI/CD**: GitHub Actions

## Getting Started

### Prerequisites

- Node.js 20+
- Yarn (latest version)

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd gentryriggen.com
```

2. Install dependencies:

```bash
yarn install
```

3. Run the development server:

```bash
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

- `yarn dev` - Start development server
- `yarn build` - Build for production
- `yarn start` - Start production server
- `yarn lint` - Run ESLint
- `yarn format` - Format code with Prettier
- `yarn format:check` - Check code formatting
- `yarn test` - Run unit tests
- `yarn test:watch` - Run tests in watch mode
- `yarn test:coverage` - Generate test coverage report
- `yarn test:e2e` - Run end-to-end tests
- `yarn test:e2e:ui` - Run E2E tests with UI
- `yarn test:all` - Run all tests (unit + E2E)

## Project Structure

```
gentryriggen.com/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Landing page
│   ├── globals.css         # Global styles
│   └── __tests__/         # Page tests
├── components/             # Reusable components
│   ├── Header.tsx
│   ├── Hero.tsx
│   ├── Footer.tsx
│   └── __tests__/         # Component tests
├── e2e/                   # End-to-end tests
├── .github/workflows/     # CI/CD workflows
├── firebase.json          # Firebase configuration
├── jest.config.js         # Jest configuration
└── playwright.config.ts   # Playwright configuration
```

## Testing

### Unit Tests

Unit tests are written using Jest and React Testing Library. They test individual components and their behavior.

```bash
yarn test
```

### End-to-End Tests

E2E tests are written using Playwright and test critical user flows.

```bash
yarn test:e2e
```

## Deployment

### Firebase Hosting Setup

1. Install Firebase CLI globally (if not already installed):

```bash
yarn global add firebase-tools
```

2. Login to Firebase:

```bash
firebase login
```

3. Initialize Firebase in your project:

```bash
firebase init hosting
```

4. Update `.firebaserc` with your Firebase project ID:

```json
{
  "projects": {
    "default": "your-firebase-project-id"
  }
}
```

5. Build and deploy:

```bash
yarn build
firebase deploy
```

### Automated Deployment

The project is configured with GitHub Actions for automated deployment:

- **On Pull Requests**: Runs all tests (linting, unit tests, E2E tests)
- **On Main Branch Push**: Runs tests, builds, and deploys to Firebase Hosting

#### Required GitHub Secrets

Set up the following secrets in your GitHub repository settings:

- `FIREBASE_SERVICE_ACCOUNT`: Firebase service account JSON (for deployment)
- `FIREBASE_PROJECT_ID`: Your Firebase project ID

To get the service account:

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Copy the JSON content and add it as a GitHub secret

## Development

### Code Quality

- **ESLint**: Code linting with Next.js recommended rules
- **Prettier**: Code formatting
- **TypeScript**: Type checking

### Contributing

1. Create a feature branch
2. Make your changes
3. Run tests: `yarn test:all`
4. Ensure linting passes: `yarn lint`
5. Ensure formatting is correct: `yarn format:check`
6. Submit a pull request

## License

Private - All rights reserved.
