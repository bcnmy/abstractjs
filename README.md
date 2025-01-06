# AbstractJS

Currently named: `abstractjs`

In order to run the repository:

```sh
bun i
```

```sh
bun test
```

## Linking & Developing

To link the package to your project, run:

```sh
bun run dev
```

Then in your linked project, update your package.json dependencies to point to the local SDK:

```json
{
  "dependencies": {
    "@biconomy/abstractjs": "file:../../abstractjs"
  }
}

This will run the package in watch mode, and will automatically update the package in your linked project.

## Tests

Currently the only tests which this project has interact with testnets, due to several limitations:

- AbrstactJS depends on triggering bridges and intent solvers, all of which can't be properly
  simulated in a local environment.
- AbstractJS depends on the MEE Node, which hasn't
  yet been set-up in a local environment.
- For tests to work, an `.env` file needs to contain the `TEST_PRIVATE_KEY` variable!

Run tests with `bun test`

## Building 

To build the project do `bun run build`

## Publishing

### Production Release
To publish a new production version:

1. Create a new changeset (documents your changes):
```sh
bun run changeset
```

2. Version the package (updates package.json and changelog):
```sh
bun run changeset:version
```

3. Publish to npm:
```sh
bun run changeset:release
```

### Canary Release
To publish a canary (preview) version:
```sh
bun run changeset:release:canary
```

This will publish a canary version to npm with a temporary version number. The original package.json will be restored automatically after publishing.

**Note:** You need to have appropriate npm permissions to publish the package.
