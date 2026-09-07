/**
 * Every language this contract is emitted into.
 *
 * A list rather than six imports in `generate.ts`, so adding a seventh is one
 * line in one place and the runner never has to know how many there are.
 */

import type { Api } from '../spec';
import { typescript } from './typescript';
import { python } from './python';

export type Emitter = (api: Api) => Record<string, string>;

export const emitters: Emitter[] = [typescript, python];
