---
title: Migrating from v3 to v4
---

Looking for the [v3 docs](https://v3.gatsbyjs.com)?

> Have you run into something that's not covered here? [Add your changes to GitHub](https://github.com/gatsbyjs/gatsby/tree/v4-docs/docs/docs/reference/release-notes/migrating-from-v3-to-v4.md)!

## Introduction

This is a reference for upgrading your site from Gatsby 3 to Gatsby 4. Version 4 is currently in Beta and thus this guide is not finalized yet. While the (breaking) changes might slightly change during the Beta and Release Candidate period the major breaking changes are already in and following this guide should set you up for success when the stable release is available.

## Table of Contents

- [Handling Deprecations](#handling-deprecations)
- [Updating Your Dependencies](#updating-your-dependencies)
- [Handling Breaking Changes](#handling-breaking-changes)
- [Future Breaking Changes](#future-breaking-changes)
- [For Plugin Maintainers](#for-plugin-maintainers)
- [Known Issues](#known-issues)

## Handling Deprecations

Before upgrading to v4 we highly recommend upgrading `gatsby` (and all plugins) to the latest v3 version.
Some changes required for Gatsby v4 could be applied incrementally to the latest v3 which should contribute to smoother upgrade experience.

> Use `npm outdated` or `yarn upgrade-interactive --latest` for automatic upgrade to the latest v3 release.

After upgrading, run `gatsby build` and look for deprecation messages in the build log.
Follow instructions to fix those deprecations.

## Updating Your Dependencies

Next, you need to update your dependencies to v4 beta.

### Update Gatsby version

You need to update your `package.json` to use the `next` version of Gatsby.

```json:title=package.json
{
  "dependencies": {
    "gatsby": "next"
  }
}
```

Or run

```shell
npm install gatsby@next
```

**Please note:** If you use **npm 7** you'll want to use the `--legacy-peer-deps` option when following the instructions in this guide. For example, the above command would be:

```shell
npm install gatsby@next --legacy-peer-deps
```

### Update Gatsby related packages

Update your `package.json` to use the `next` version of Gatsby related packages. You should upgrade any package name that starts with `gatsby-*`. Note, this only applies to plugins managed in the [gatsbyjs/gatsby](https://github.com/gatsbyjs/gatsby) repository. If you're using community plugins, they might not be upgraded yet. Please check their repository for the current status.

#### Updating community plugins

Using community plugins, you might see warnings like these in your terminal:

```shell
warning Plugin gatsby-plugin-acme is not compatible with your gatsby version 4.0.0 - It requires gatsby@^3.10.0
```

If you are using npm 7, the warning may instead be an error:

```shell
npm ERR! ERESOLVE unable to resolve dependency tree
```

This is because the plugin needs to update its `peerDependencies` to include the new version of Gatsby (see section [for plugin maintainers](#for-plugin-maintainers)). While this might indicate that the plugin has incompatibilities, in most cases they should continue to work. When using npm 7, you can pass the `--legacy-peer-deps` to ignore the warning and install anyway. Please look for already opened issues or PRs on the plugin's repository to see the status. If you don't see any, help the maintainers by opening an issue or PR yourself! :)

## Handling Breaking Changes

This section explains breaking changes that were made for Gatsby 4. Some of those changes had a deprecation message in v3. In order to successfully update, you'll need to resolve these changes.

### Minimal Node.js version 14.15.0

We are dropping support for Node 12 as a new underlying dependency (`lmdb-store`) is requiring `>=14.15.0`. See the main changes in [Node 14 release notes](https://nodejs.org/en/blog/release/v14.0.0/).

Check [Node’s releases document](https://github.com/nodejs/Release#nodejs-release-working-group) for version statuses.

### Disallow schema-related APIs in `sourceNodes`

You can no longer use `createFieldExtension`, `createTypes` & `addThirdPartySchema` actions inside the [`sourceNodes`](/docs/reference/config-files/gatsby-node#sourceNodes) lifecycle.
Instead, move them to [`createSchemaCustomization`](/docs/reference/config-files/gatsby-node#createSchemaCustomization) API. Or alternatively use [`createResolvers`](/docs/reference/config-files/gatsby-node#createResolvers) API.

The reasoning behind this is that this way Gatsby can safely build the schema and run queries in a separate process without running sourcing.

### Change arguments passed to `touchNode` action

For Gatsby v2 & v3 the `touchNode` API accepted `nodeId` as a named argument. This now has been changed in favor of passing the full `node` to the function.

```diff:title=gatsby-node.js
exports.sourceNodes = ({ actions, getNodesByType }) => {
  const { touchNode } = actions

- getNodesByType("YourSourceType").forEach(node => touchNode({ nodeId: node.id }))
+ getNodesByType("YourSourceType").forEach(node => touchNode(node))
}
```

In case you only have an ID at hand (e.g. getting it from cache), you can use the `getNode()` API:

```js:title=gatsby-node.js
exports.sourceNodes = async ({ actions, getNodesByType, cache }) => {
  const { touchNode, getNode } = actions
  const myNodeId = await cache.get("some-key")

  touchNode(getNode(myNodeId)) // highlight-line
}
```

### Change arguments passed to `deleteNode` action

For Gatsby v2 & v3, the `deleteNode` API accepted `node` as a named argument. This now has been changed in favor of passing the full `node` to the function.

```diff:title=gatsby-node.js
exports.onCreateNode = ({ actions, node }) => {
  const { deleteNode } = actions

- deleteNode({ node })
+ deleteNode(node)
}
```

### Replace `@nodeInterface` with interface inheritance

For Gatsby v2 & v3, `@nodeInterface` was the recommended way to implement [queryable interfaces](/docs/reference/graphql-data-layer/schema-customization/#queryable-interfaces-with-the-nodeinterface-extension).
Now it is changed in favor of interface inheritance:

```diff:title=gatsby-node.js
exports.createSchemaCustomization = ({ actions }) => {
  const { createTypes } = actions
  createTypes(`
-   interface Foo @nodeInterface
+   interface Foo implements Node
    {
      id: ID!
    }
  `)
}
```

### Use `onPluginInit` API to share context with other lifecycle APIs

Sites and in particular plugins that rely on setting values on module context to access them later in other lifecycles will need to use `onPluginInit`. This is also the case for when you use `onPreInit` or `onPreBootstrap`. The `onPluginInit` API will run in each worker as it is initialized and thus each worker then has the initial plugin state.

Here's an example of a v3 plugin fetching a GraphQL schema at the earliest stage in order to use it in later lifecycles:

```js:title=gatsby-node.js
const stateCache = {}

const initializePlugin = async (args, pluginOptions) => {
  const res = await getRemoteGraphQLSchema()
  const graphqlSdl = await generateSdl(res)
  const typeMap = await generateTypeMap(res)

  stateCache['sdl'] = graphqlSdl
  stateCache['typeMap'] = typeMap
}

// highlight-start
exports.onPreBootstrap = async (args, pluginOptions) => {
  await initializePlugin(args, pluginOptions)
}
// highlight-end

exports.createResolvers = ({ createResolvers }, pluginOptions) => {
  const typeMap = stateCache['typeMap']

  createResolvers(generateResolvers(typeMap))
}

exports.createSchemaCustomization = ({ actions }, pluginOptions) => {
  const { createTypes } = actions

  const sdl = stateCache['sdl']

  createTypes(sdl)
}
```

In order to make this work for Gatsby 4 & Parallel Query Running the logic inside `onPreBootstrap` must be moved to `onPluginInit`:

```js:title=gatsby-node.js
// Rest of initializePlugin stays the same

exports.onPluginInit = async (args, pluginOptions) => {
  await initializePlugin(args, pluginOptions)
}

// Schema APIs stay the same
```

This also applies to using the `reporter.setErrorMap` function. It now also needs to be run inside `onPluginInit` instead of in `onPreInit`.

```js
const ERROR_MAP = {
  10000: {
    text: context => context.sourceMessage,
    level: "ERROR",
    category: "SYSTEM",
  },
}

// highlight-start
exports.onPluginInit = ({ reporter }) => {
  reporter.setErrorMap(ERROR_MAP)
}
// highlight-end

const getDataFromAPI = async ({ reporter }) => {
  let data
  try {
    const res = await requestAPI()
    data = res
  } catch (error) {
    reporter.panic({
      id: "10000",
      context: {
        sourceMessage: error.message,
      },
    })
  }

  return data
}
```

### Remove obsolete flags

Remove the flags for `QUERY_ON_DEMAND` and `PRESERVE_WEBPACK_CACHE` from `gatsby-config`. Those features are a part of gatsby core now and don't need to be enabled nor can't be disabled using those flags.

### Do not create nodes in custom resolvers

The most typical scenario is when people use `createRemoteFileNode` in custom resolvers to lazily download
only those files that are referenced in page queries.

It is a well-known workaround aimed for build time optimization, however it breaks a contract Gatsby establishes
with plugins and prevents us from running queries in parallel and makes other use-cases harder
(like using GraphQL layer in functions).

The recommended approach is to always create nodes in `sourceNodes`. We are going to come up with alternatives to
this workaround that will work using `sourceNodes`. It is still being worked on, please post your use-cases and ideas
in [this discussion](https://github.com/gatsbyjs/gatsby/discussions/32860#discussioncomment-1262874) to help us shape this new APIs.

### Removal of `gatsby-admin`

You can no longer use `gatsby-admin` (activated with environment variable `GATSBY_EXPERIMENTAL_ENABLE_ADMIN`) as we removed this functionality from `gatsby` itself. We didn't see any major usage and don't plan on developing this further in the foreseeable future.

### Gatsby related packages

Breaking Changes in plugins that we own and maintain.

#### `gatsby-plugin-feed`

- The `feeds` option is required now
- The `serialize` key inside the `feeds` option is required now. Please define your own function if you used the default one until now.

## Future Breaking Changes

This section explains deprecations that were made for Gatsby 4. These old behaviors will be removed in v5, at which point they will no longer work. For now, you can still use the old behaviors in v4, but we recommend updating to the new signatures to make future updates easier.

### `nodeModel.runQuery` is deprecated

Use `nodeModel.findAll` and `nodeModel.findOne` instead. Those are almost a drop-in replacement for `runQuery`:

```js
const entries = await nodeModel.runQuery({
  type: `MyType`,
  query: {
    /* ... */
  },
  firstOnly: false,
})
// is the same as:
const { entries } = await nodeModel.findAll({
  type: `MyType`,
  query: {
    /* ... */
  },
})

const node = await nodeModel.runQuery({
  type: `MyType`,
  query: {
    /* ... */
  },
  firstOnly: true,
})
// is the same as:
const node = await nodeModel.findOne({
  type: `MyType`,
  query: {
    /* ... */
  },
})
```

The two differences are:

1. `findAll` supports `limit`/`skip` arguments. `runQuery` ignores them when passed.
2. `findAll` returns an object with `{ entries: GatsbyIterable, totalCount: () => Promise<number> }` while `runQuery`
   returns a plain array of nodes

```js
// Assuming we have 100,000 nodes of the type `MyQuery`,
// the following returns an array with all 100,000 nodes
const entries = await nodeModel.runQuery({
  type: `MyType`,
  query: { limit: 20, skip: 10 },
})

// findAll returns 20 entries (starting from 10th)
// and allows to get total count using totalCount() if required:
const { entries, totalCount } = await nodeModel.findAll({
  type: `MyType`,
  query: { limit: 20, skip: 10 },
})
const count = await totalCount()
```

If you don't pass `limit` and `skip`, `findAll` returns all nodes in `{ entries }` iterable.
Check out the [source code of GatsbyIterable](https://github.com/gatsbyjs/gatsby/blob/master/packages/gatsby/src/datastore/common/iterable.ts)
for usage.

### `nodeModel.getAllNodes` is deprecated

Gatsby v4 uses persisted data store for nodes (using [lmdb-store](https://github.com/DoctorEvidence/lmdb-store))
and fetching an unbounded number of nodes won't play well with it in the long run.

We recommend using `nodeModel.findAll` instead with empty query as it at least returns an iterable and not an array.

```js
// replace:
const entries = nodeModel.getAllNodes(`MyType`)

// with
const { entries } = await nodeModel.findAll({ type: `MyType`, query: {} })
```

However, we highly recommend restricting the number of fetched nodes at once. So this is even better:

```js
const { entries } = await nodeModel.findAll({
  type: `MyType`,
  query: { limit: 20 },
})
```

### `___NODE` convention is deprecated

Gatsby was using `___NODE` suffix of node fields to magically detect relations between nodes. But starting
with [gatsby 2.5](/blog/2019-05-17-improvements-to-schema-customization/) `@link` directive is a preferred method:

Before:

```js
exports.sourceNodes = ({ actions }) => {
  actions.createNode({
    // ...required node fields
    author___NODE: userNode.id,
    internal: { type: `BlogPost` /*...*/ },
  })
}
```

After:

```js
exports.sourceNodes = ({ actions }) => {
  actions.createNode({
    // ...required node fields
    author: userNode.id,
    internal: { type: `BlogPost` /*...*/ },
  })
}
exports.createSchemaCustomization = ({ actions }) => {
  actions.createTypes(`
    type BlogPost implements Node {
      author: User @link
    }
  `)
}
```

Follow [this how-to guide](/docs/how-to/plugins-and-themes/creating-a-source-plugin/#create-foreign-key-relationships-between-data) for up-to-date guide on sourcing and defining data relations.

## For Plugin Maintainers

In most cases, you won't have to do anything to be v4 compatible. The underlying changes mostly affect **source** plugins. But one thing you can do to be certain your plugin won't throw any warnings or errors is to set the proper peer dependencies.

Please also note that some of the items inside "Handling Breaking Changes" may also apply to your plugin.

`gatsby` should be included under `peerDependencies` of your plugin and it should specify the proper versions of support.

```diff:title=package.json
{
  "peerDependencies": {
-   "gatsby": "^3.0.0",
+   "gatsby": "^4.0.0",
  }
}
```

If your plugin supports both versions:

```diff:title=package.json
{
  "peerDependencies": {
-   "gatsby": "^2.32.0",
+   "gatsby": "^3.0.0 || ^4.0.0",
  }
}
```

### Don't mutate nodes outside of expected APIs

Before v4 you could do something like this, and it was working:

```js
exports.sourceNodes = ({ actions }) => {
  const node = {
    /* */
  }
  actions.createNode(node)

  // somewhere else:
  node.image___NODE = `uuid-of-some-other-node`
}
```

This was never an intended feature of Gatsby and is considered an anti-pattern (see [#19876](https://github.com/gatsbyjs/gatsby/issues/19876) for additional information).

Starting with v4 Gatsby introduces a persisted storage for nodes and thus this pattern will no longer work
because nodes are persisted after `createNode` call and all direct mutations after that will be lost.

Unfortunately it is hard to detect it automatically (without sacrificing performance), so we recommend you to
check your code to ensure you don't mutate nodes directly.

Gatsby provides several actions available in `sourceNodes` and `onCreateNode` APIs to use instead:

- [createNode](/docs/reference/config-files/actions/#createNode)
- [deleteNode](/docs/reference/config-files/actions/#deleteNode)
- [createNodeField](/docs/reference/config-files/actions/#createNodeField)

### No support for circular references in data

The current state persistence mechanism supported circular references in nodes. With Gatsby 4 and LMDB this is no longer supported.

This is just a theoretical problem that might arise in v4. Most source plugins already avoid circular dependencies in data.

## Known Issues

This section is a work in progress and will be expanded when necessary. It's a list of known issues you might run into while upgrading Gatsby to v4 and how to solve them.

If you encounter any problem, please let us know in this [GitHub discussion](https://github.com/gatsbyjs/gatsby/discussions/32860).