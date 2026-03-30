/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as gameLogic from "../gameLogic.js";
import type * as mutations_presence from "../mutations/presence.js";
import type * as mutations_rounds from "../mutations/rounds.js";
import type * as mutations_sessions from "../mutations/sessions.js";
import type * as queries_rounds from "../queries/rounds.js";
import type * as queries_sessions from "../queries/sessions.js";
import type * as types from "../types.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  gameLogic: typeof gameLogic;
  "mutations/presence": typeof mutations_presence;
  "mutations/rounds": typeof mutations_rounds;
  "mutations/sessions": typeof mutations_sessions;
  "queries/rounds": typeof queries_rounds;
  "queries/sessions": typeof queries_sessions;
  types: typeof types;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
