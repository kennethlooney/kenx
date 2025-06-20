# Installation

Get started with Kenx Framework in just a few steps.

## Prerequisites

Before installing Kenx, make sure you have:

- **Node.js** 16.0.0 or higher
- **npm** 7.0.0 or higher (for workspace support)
- **TypeScript** knowledge (recommended)

## Installation Options

### Option 1: Using npm (Recommended)

```bash
npm install @kenx/framework
```

### Option 2: Using yarn

```bash
yarn add @kenx/framework
```

### Option 3: Clone from Source

```bash
git clone https://github.com/yourusername/kenx.git
cd kenx
npm install
npm run build
```

## Verify Installation

Create a simple test file to verify your installation:

```typescript
// test.ts
import kenx from '@kenx/framework';

const app = kenx();

app.get('/', (req, res) => {
  res.json({ message: 'Kenx is working!' });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

Run the test:

```bash
npx ts-node test.ts
```

Visit `http://localhost:3000` - you should see the JSON response!

## Next Steps

Now that you have Kenx installed, let's create your first application:

→ [Your First App](/wiki/getting-started/first-app)
