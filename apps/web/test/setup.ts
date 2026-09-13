import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Unmount between tests.
 *
 * Without this every rendered tree stays in the document, so a `getByRole`
 * query in the fourth test can match a button the first test rendered — which
 * fails as "found multiple elements" if you are lucky and passes against the
 * wrong element if you are not.
 */
afterEach(cleanup);
