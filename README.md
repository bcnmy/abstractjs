# AbstractJS

Currently named: `mee-experimental`

In order to run the repository:

`bun i`
`bun test`

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
