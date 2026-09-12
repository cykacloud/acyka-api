// Generated from openapi.json by tools/generate.ts. Do not edit.

import type { Core } from '../core';
import type {
	Airing,
	Appearance,
	Character,
	CharacterCard,
	Collection,
	CollectionBody,
	CollectionItem,
	EntryBody,
	Episode,
	ListBody,
	ListEntry,
	Me,
	Page,
	Person,
	PersonCard,
	PersonPage,
	Post,
	PostBody,
	Profile,
	Related,
	ScoreBody,
	Stats,
	Title,
	TitleCard,
	TitleCharacter,
	TitleStaff,
	Voice,
	VoicedRole,
} from './types';

/** Only the keys a query string wants, and only the ones that were given. */
function pick<T extends object>(input: T | undefined, keys: string[]): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	if (!input) return out;
	for (const key of keys) {
		const value = (input as Record<string, unknown>)[key];
		// `undefined` means "not asked for" and is left out; `null` and `0` and
		// `false` are answers and are sent.
		if (value !== undefined) out[key] = value;
	}
	return out;
}

/**
 * the account a token acts for
 */
export class Account {
	constructor(private readonly core: Core) {}

	/**
	 * It exists beside userinfo rather than instead of it because userinfo's shape
	 * is fixed by the spec and this one is ours to grow.
	 *
	 * `GET /api/v1/me`
	 * @scope `profile`
	 */
	getMe(): Promise<Me> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/me`,
			scope: 'profile',
		});
	}
}

/**
 * titles, people, characters and what is airing
 */
export class Catalogue {
	constructor(private readonly core: Core) {}

	/**
	 * A projection rather than a schedule: an ongoing series has no per-episode
	 * timetable anywhere upstream, so the day of episode *n* is worked out from
	 * the start date and a seven-day cadence. Irregular shows are wrong by a few
	 * days and this says nothing about it, because a calendar that hid everything
	 * it was not certain of would be an empty page most weeks. `out` is the part
	 * that is not a projection — an episode a dub is already held for is playable
	 * now, whatever the arithmetic says.
	 *
	 * The site's `?mine=1` is not offered. It narrows to the reader's own shelf,
	 * which is a second way of asking a question `/v1/lists` already answers, and
	 * a filter that means nothing at all for an application speaking for itself.
	 * The `viewer` argument below is therefore `None` — it exists to answer that
	 * filter and there is nothing else it decides.
	 *
	 * 18+ is the caller's own switch, like every other read here: a calendar is a
	 * shelf with dates on it, and it must not be the one page that names a title
	 * the reader asked not to see.
	 *
	 * `GET /api/v1/calendar`
	 * @scope `catalog:read`
	 */
	calendar(input?: {
		/** which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`. Defaults to `en`. */
		lang?: string;
	}): Promise<Page<Airing>> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/calendar`,
			query: pick(input, ['lang']),
			scope: 'catalog:read',
		});
	}

	/**
	 *
	 * `GET /api/v1/characters/{id}/titles`
	 * @scope `catalog:read`
	 */
	characterTitles(input: {
		/** the shikimori id */
		id: number;
		/** which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`. Defaults to `en`. */
		lang?: string;
		/** how many rows, 1-100; 30 by default */
		limit?: number;
		/** where to carry on from */
		offset?: number;
	}): Promise<Page<Appearance>> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/characters/${encodeURIComponent(String(input.id))}/titles`,
			query: pick(input, ['lang', 'limit', 'offset']),
			scope: 'catalog:read',
		});
	}

	/**
	 * Every row of `characterTitles`, a page at a time.
	 *
	 * Stops when a page comes back shorter than it asked for rather than
	 * when `total` is reached: the list can grow while it is being read, and
	 * counting against a number from the first page walks off the end.
	 */
	async *characterTitlesAll(input: {
		/** the shikimori id */
		id: number;
		/** which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`. Defaults to `en`. */
		lang?: string;
		/** how many rows, 1-100; 30 by default */
		limit?: number;
		/** where to carry on from */
		offset?: number;
	}): AsyncGenerator<Appearance> {
		let offset = input?.offset ?? 0;
		const limit = input?.limit ?? 100;
		for (;;) {
			const page = await this.characterTitles({ ...(input as object), limit, offset } as never);
			for (const row of page.items) yield row;
			if (page.items.length < limit) return;
			offset += page.items.length;
		}
	}

	/**
	 * Whoever has voiced this character, once each, japanese first.
	 *
	 * `GET /api/v1/characters/{id}/voices`
	 * @scope `catalog:read`
	 */
	characterVoices(input: {
		/** the shikimori id */
		id: number;
		/** which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`. Defaults to `en`. */
		lang?: string;
	}): Promise<Page<Voice>> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/characters/${encodeURIComponent(String(input.id))}/voices`,
			query: pick(input, ['lang']),
			scope: 'catalog:read',
		});
	}

	/**
	 *
	 * `GET /api/v1/characters/{id}`
	 * @scope `catalog:read`
	 */
	getCharacter(input: {
		/** the shikimori id */
		id: number;
		/** which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`. Defaults to `en`. */
		lang?: string;
	}): Promise<Character> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/characters/${encodeURIComponent(String(input.id))}`,
			query: pick(input, ['lang']),
			scope: 'catalog:read',
		});
	}

	/**
	 *
	 * `GET /api/v1/people/{id}`
	 * @scope `catalog:read`
	 */
	getPerson(input: {
		/** the shikimori id */
		id: number;
		/** which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`. Defaults to `en`. */
		lang?: string;
	}): Promise<PersonPage> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/people/${encodeURIComponent(String(input.id))}`,
			query: pick(input, ['lang']),
			scope: 'catalog:read',
		});
	}

	/**
	 *
	 * `GET /api/v1/titles/{id}`
	 * @scope `catalog:read`
	 */
	getTitle(input: {
		/** the shikimori id */
		id: number;
		/** which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`. Defaults to `en`. */
		lang?: string;
	}): Promise<Title> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/titles/${encodeURIComponent(String(input.id))}`,
			query: pick(input, ['lang']),
			scope: 'catalog:read',
		});
	}

	/**
	 * The vocabulary the whole catalogue is described in.
	 *
	 * `GET /api/v1/genres`
	 * @scope `catalog:read`
	 */
	listGenres(): Promise<Page<string>> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/genres`,
			scope: 'catalog:read',
		});
	}

	/**
	 *
	 * `GET /api/v1/titles`
	 * @scope `catalog:read`
	 */
	listTitles(input?: {
		/** which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`. Defaults to `en`. */
		lang?: string;
		/** how many rows, 1-100; 30 by default */
		limit?: number;
		/** where to carry on from */
		offset?: number;
		/** what to search for */
		q?: string;
		/** `ranked` by score, `aired_on` by year, `trending` by what is being watched right now; by how watched it is overall otherwise */
		order?: string;
		/** `ongoing` | `released` | `announced` */
		status?: string;
		/** `tv` | `movie` | `ova` | `ona` | `special` | `music` */
		kind?: string;
		/** comma-separated; every named genre must be on the title */
		genre?: string;
		/** at least this */
		score?: number;
		year_from?: number;
		year_to?: number;
		/** the age rating */
		rating?: string;
	}): Promise<Page<TitleCard>> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/titles`,
			query: pick(input, ['lang', 'limit', 'offset', 'q', 'order', 'status', 'kind', 'genre', 'score', 'year_from', 'year_to', 'rating']),
			scope: 'catalog:read',
		});
	}

	/**
	 * Every row of `listTitles`, a page at a time.
	 *
	 * Stops when a page comes back shorter than it asked for rather than
	 * when `total` is reached: the list can grow while it is being read, and
	 * counting against a number from the first page walks off the end.
	 */
	async *listTitlesAll(input?: {
		/** which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`. Defaults to `en`. */
		lang?: string;
		/** how many rows, 1-100; 30 by default */
		limit?: number;
		/** where to carry on from */
		offset?: number;
		/** what to search for */
		q?: string;
		/** `ranked` by score, `aired_on` by year, `trending` by what is being watched right now; by how watched it is overall otherwise */
		order?: string;
		/** `ongoing` | `released` | `announced` */
		status?: string;
		/** `tv` | `movie` | `ova` | `ona` | `special` | `music` */
		kind?: string;
		/** comma-separated; every named genre must be on the title */
		genre?: string;
		/** at least this */
		score?: number;
		year_from?: number;
		year_to?: number;
		/** the age rating */
		rating?: string;
	}): AsyncGenerator<TitleCard> {
		let offset = input?.offset ?? 0;
		const limit = input?.limit ?? 100;
		for (;;) {
			const page = await this.listTitles({ ...(input as object), limit, offset } as never);
			for (const row of page.items) yield row;
			if (page.items.length < limit) return;
			offset += page.items.length;
		}
	}

	/**
	 * The other half of a voice actor: who they have played.
	 *
	 * `GET /api/v1/people/{id}/characters`
	 * @scope `catalog:read`
	 */
	personCharacters(input: {
		/** the shikimori id */
		id: number;
		/** which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`. Defaults to `en`. */
		lang?: string;
		/** how many rows, 1-100; 30 by default */
		limit?: number;
		/** where to carry on from */
		offset?: number;
	}): Promise<Page<VoicedRole>> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/people/${encodeURIComponent(String(input.id))}/characters`,
			query: pick(input, ['lang', 'limit', 'offset']),
			scope: 'catalog:read',
		});
	}

	/**
	 * Every row of `personCharacters`, a page at a time.
	 *
	 * Stops when a page comes back shorter than it asked for rather than
	 * when `total` is reached: the list can grow while it is being read, and
	 * counting against a number from the first page walks off the end.
	 */
	async *personCharactersAll(input: {
		/** the shikimori id */
		id: number;
		/** which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`. Defaults to `en`. */
		lang?: string;
		/** how many rows, 1-100; 30 by default */
		limit?: number;
		/** where to carry on from */
		offset?: number;
	}): AsyncGenerator<VoicedRole> {
		let offset = input?.offset ?? 0;
		const limit = input?.limit ?? 100;
		for (;;) {
			const page = await this.personCharacters({ ...(input as object), limit, offset } as never);
			for (const row of page.items) yield row;
			if (page.items.length < limit) return;
			offset += page.items.length;
		}
	}

	/**
	 *
	 * `GET /api/v1/people/{id}/titles`
	 * @scope `catalog:read`
	 */
	personTitles(input: {
		/** the shikimori id */
		id: number;
		/** which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`. Defaults to `en`. */
		lang?: string;
		/** how many rows, 1-100; 30 by default */
		limit?: number;
		/** where to carry on from */
		offset?: number;
	}): Promise<Page<Appearance>> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/people/${encodeURIComponent(String(input.id))}/titles`,
			query: pick(input, ['lang', 'limit', 'offset']),
			scope: 'catalog:read',
		});
	}

	/**
	 * Every row of `personTitles`, a page at a time.
	 *
	 * Stops when a page comes back shorter than it asked for rather than
	 * when `total` is reached: the list can grow while it is being read, and
	 * counting against a number from the first page walks off the end.
	 */
	async *personTitlesAll(input: {
		/** the shikimori id */
		id: number;
		/** which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`. Defaults to `en`. */
		lang?: string;
		/** how many rows, 1-100; 30 by default */
		limit?: number;
		/** where to carry on from */
		offset?: number;
	}): AsyncGenerator<Appearance> {
		let offset = input?.offset ?? 0;
		const limit = input?.limit ?? 100;
		for (;;) {
			const page = await this.personTitles({ ...(input as object), limit, offset } as never);
			for (const row of page.items) yield row;
			if (page.items.length < limit) return;
			offset += page.items.length;
		}
	}

	/**
	 * One title, at random, out of the ones that can actually be watched here.
	 *
	 * `GET /api/v1/titles/random`
	 * @scope `catalog:read`
	 */
	randomTitle(input?: {
		/** which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`. Defaults to `en`. */
		lang?: string;
	}): Promise<TitleCard> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/titles/random`,
			query: pick(input, ['lang']),
			scope: 'catalog:read',
		});
	}

	/**
	 * The title asked about is in the list rather than dropped from it, because
	 * the one thing this shelf is for is saying where in a sequence somebody is —
	 * `current` is what lets a client mark it in place.
	 *
	 * `GET /api/v1/titles/{id}/related`
	 * @scope `catalog:read`
	 */
	relatedTitles(input: {
		/** the shikimori id */
		id: number;
		/** which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`. Defaults to `en`. */
		lang?: string;
	}): Promise<Page<Related>> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/titles/${encodeURIComponent(String(input.id))}/related`,
			query: pick(input, ['lang']),
			scope: 'catalog:read',
		});
	}

	/**
	 * A resource of its own rather than a kind inside one `/search`. The site has
	 * a single search window because a person typing wants one box, and it answers
	 * an object of six collections — a shape built for that window. An application
	 * looking for a character wants characters, paged, and asking it to unwrap
	 * five lists it did not want is the `?include=` this api does not have,
	 * backwards.
	 *
	 * `GET /api/v1/characters`
	 * @scope `catalog:read`
	 */
	searchCharacters(input?: {
		/** what to search for */
		q?: string;
		/** which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`. Defaults to `en`. */
		lang?: string;
		/** how many rows, 1-100; 30 by default */
		limit?: number;
	}): Promise<Page<CharacterCard>> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/characters`,
			query: pick(input, ['q', 'lang', 'limit']),
			scope: 'catalog:read',
		});
	}

	/**
	 *
	 * `GET /api/v1/people`
	 * @scope `catalog:read`
	 */
	searchPeople(input?: {
		/** what to search for */
		q?: string;
		/** which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`. Defaults to `en`. */
		lang?: string;
		/** how many rows, 1-100; 30 by default */
		limit?: number;
	}): Promise<Page<PersonCard>> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/people`,
			query: pick(input, ['q', 'lang', 'limit']),
			scope: 'catalog:read',
		});
	}

	/**
	 * The weighting is the whole of what makes this useful rather than "the twelve
	 * most popular titles in the catalogue", and it is not a thing to have two of
	 * — so this is `similar_to`, the same shelf `/similar` in Discord is.
	 *
	 * `GET /api/v1/titles/{id}/similar`
	 * @scope `catalog:read`
	 */
	similarTitles(input: {
		/** the shikimori id */
		id: number;
		/** which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`. Defaults to `en`. */
		lang?: string;
	}): Promise<Page<TitleCard>> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/titles/${encodeURIComponent(String(input.id))}/similar`,
			query: pick(input, ['lang']),
			scope: 'catalog:read',
		});
	}

	/**
	 *
	 * `GET /api/v1/titles/{id}/characters`
	 * @scope `catalog:read`
	 */
	titleCharacters(input: {
		/** the shikimori id */
		id: number;
		/** which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`. Defaults to `en`. */
		lang?: string;
		/** how many rows, 1-100; 30 by default */
		limit?: number;
		/** where to carry on from */
		offset?: number;
	}): Promise<Page<TitleCharacter>> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/titles/${encodeURIComponent(String(input.id))}/characters`,
			query: pick(input, ['lang', 'limit', 'offset']),
			scope: 'catalog:read',
		});
	}

	/**
	 * Every row of `titleCharacters`, a page at a time.
	 *
	 * Stops when a page comes back shorter than it asked for rather than
	 * when `total` is reached: the list can grow while it is being read, and
	 * counting against a number from the first page walks off the end.
	 */
	async *titleCharactersAll(input: {
		/** the shikimori id */
		id: number;
		/** which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`. Defaults to `en`. */
		lang?: string;
		/** how many rows, 1-100; 30 by default */
		limit?: number;
		/** where to carry on from */
		offset?: number;
	}): AsyncGenerator<TitleCharacter> {
		let offset = input?.offset ?? 0;
		const limit = input?.limit ?? 100;
		for (;;) {
			const page = await this.titleCharacters({ ...(input as object), limit, offset } as never);
			for (const row of page.items) yield row;
			if (page.items.length < limit) return;
			offset += page.items.length;
		}
	}

	/**
	 * **Not a list of episodes to watch, and deliberately not one.** Where a dub
	 * can be played and by whom is `/video/streams`, which is somebody else's
	 * files under somebody else's terms and is not on this door at all. This is
	 * what the `shots` pass pulled onto our own storage, and an episode with no
	 * frames is simply absent.
	 *
	 * `GET /api/v1/titles/{id}/episodes`
	 * @scope `catalog:read`
	 */
	titleEpisodes(input: {
		/** the shikimori id */
		id: number;
	}): Promise<Page<Episode>> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/titles/${encodeURIComponent(String(input.id))}/episodes`,
			scope: 'catalog:read',
		});
	}

	/**
	 *
	 * `GET /api/v1/titles/{id}/screenshots`
	 * @scope `catalog:read`
	 */
	titleScreenshots(input: {
		/** the shikimori id */
		id: number;
	}): Promise<Page<string>> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/titles/${encodeURIComponent(String(input.id))}/screenshots`,
			scope: 'catalog:read',
		});
	}

	/**
	 *
	 * `GET /api/v1/titles/{id}/staff`
	 * @scope `catalog:read`
	 */
	titleStaff(input: {
		/** the shikimori id */
		id: number;
		/** which of a title's three names leads: `en` (romaji), `ru`, `ja`, `uk`, `uz`. Defaults to `en`. */
		lang?: string;
	}): Promise<Page<TitleStaff>> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/titles/${encodeURIComponent(String(input.id))}/staff`,
			query: pick(input, ['lang']),
			scope: 'catalog:read',
		});
	}
}

/**
 * other people, as far as they have agreed to be read
 */
export class People {
	constructor(private readonly core: Core) {}

	/**
	 *
	 * `GET /api/v1/users/{nick}`
	 * @scope `people:read`
	 */
	getUser(input: {
		/** a nickname the account answers to, current or past */
		nick: string;
	}): Promise<Profile> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/users/${encodeURIComponent(String(input.nick))}`,
			scope: 'people:read',
		});
	}

	/**
	 * People by name.
	 *
	 * `GET /api/v1/users`
	 * @scope `people:read`
	 */
	searchUsers(input?: {
		/** what to search for */
		q?: string;
		/** how many rows, 1-100; 30 by default */
		limit?: number;
	}): Promise<Page<Person>> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/users`,
			query: pick(input, ['q', 'limit']),
			scope: 'people:read',
		});
	}

	/**
	 *
	 * `GET /api/v1/users/{nick}/collections`
	 * @scope `people:read`
	 */
	userCollections(input: {
		/** a nickname the account answers to, current or past */
		nick: string;
	}): Promise<Page<Collection>> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/users/${encodeURIComponent(String(input.nick))}/collections`,
			scope: 'people:read',
		});
	}

	/**
	 *
	 * `GET /api/v1/users/{nick}/followers`
	 * @scope `people:read`
	 */
	userFollowers(input: {
		/** a nickname the account answers to, current or past */
		nick: string;
		/** how many rows, 1-100; 30 by default */
		limit?: number;
		/** where to carry on from */
		offset?: number;
	}): Promise<Page<Person>> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/users/${encodeURIComponent(String(input.nick))}/followers`,
			query: pick(input, ['limit', 'offset']),
			scope: 'people:read',
		});
	}

	/**
	 * Every row of `userFollowers`, a page at a time.
	 *
	 * Stops when a page comes back shorter than it asked for rather than
	 * when `total` is reached: the list can grow while it is being read, and
	 * counting against a number from the first page walks off the end.
	 */
	async *userFollowersAll(input: {
		/** a nickname the account answers to, current or past */
		nick: string;
		/** how many rows, 1-100; 30 by default */
		limit?: number;
		/** where to carry on from */
		offset?: number;
	}): AsyncGenerator<Person> {
		let offset = input?.offset ?? 0;
		const limit = input?.limit ?? 100;
		for (;;) {
			const page = await this.userFollowers({ ...(input as object), limit, offset } as never);
			for (const row of page.items) yield row;
			if (page.items.length < limit) return;
			offset += page.items.length;
		}
	}

	/**
	 *
	 * `GET /api/v1/users/{nick}/following`
	 * @scope `people:read`
	 */
	userFollowing(input: {
		/** a nickname the account answers to, current or past */
		nick: string;
		/** how many rows, 1-100; 30 by default */
		limit?: number;
		/** where to carry on from */
		offset?: number;
	}): Promise<Page<Person>> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/users/${encodeURIComponent(String(input.nick))}/following`,
			query: pick(input, ['limit', 'offset']),
			scope: 'people:read',
		});
	}

	/**
	 * Every row of `userFollowing`, a page at a time.
	 *
	 * Stops when a page comes back shorter than it asked for rather than
	 * when `total` is reached: the list can grow while it is being read, and
	 * counting against a number from the first page walks off the end.
	 */
	async *userFollowingAll(input: {
		/** a nickname the account answers to, current or past */
		nick: string;
		/** how many rows, 1-100; 30 by default */
		limit?: number;
		/** where to carry on from */
		offset?: number;
	}): AsyncGenerator<Person> {
		let offset = input?.offset ?? 0;
		const limit = input?.limit ?? 100;
		for (;;) {
			const page = await this.userFollowing({ ...(input as object), limit, offset } as never);
			for (const row of page.items) yield row;
			if (page.items.length < limit) return;
			offset += page.items.length;
		}
	}

	/**
	 * What somebody is watching, if their list is anybody's business.
	 *
	 * `GET /api/v1/users/{nick}/lists`
	 * @scope `people:read`
	 */
	userLists(input: {
		/** a nickname the account answers to, current or past */
		nick: string;
		/** narrow to one shelf: `planned` | `watching` | `rewatching` | `paused` | `done` | `dropped` */
		status?: string;
		/** how many rows, 1-100; 30 by default */
		limit?: number;
		/** where to carry on from */
		offset?: number;
	}): Promise<Page<ListEntry>> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/users/${encodeURIComponent(String(input.nick))}/lists`,
			query: pick(input, ['status', 'limit', 'offset']),
			scope: 'people:read',
		});
	}

	/**
	 * Every row of `userLists`, a page at a time.
	 *
	 * Stops when a page comes back shorter than it asked for rather than
	 * when `total` is reached: the list can grow while it is being read, and
	 * counting against a number from the first page walks off the end.
	 */
	async *userListsAll(input: {
		/** a nickname the account answers to, current or past */
		nick: string;
		/** narrow to one shelf: `planned` | `watching` | `rewatching` | `paused` | `done` | `dropped` */
		status?: string;
		/** how many rows, 1-100; 30 by default */
		limit?: number;
		/** where to carry on from */
		offset?: number;
	}): AsyncGenerator<ListEntry> {
		let offset = input?.offset ?? 0;
		const limit = input?.limit ?? 100;
		for (;;) {
			const page = await this.userLists({ ...(input as object), limit, offset } as never);
			for (const row of page.items) yield row;
			if (page.items.length < limit) return;
			offset += page.items.length;
		}
	}

	/**
	 *
	 * `GET /api/v1/users/{nick}/stats`
	 * @scope `people:read`
	 */
	userStats(input: {
		/** a nickname the account answers to, current or past */
		nick: string;
	}): Promise<Stats> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/users/${encodeURIComponent(String(input.nick))}/stats`,
			scope: 'people:read',
		});
	}
}

/**
 * somebody's own list and shelves
 */
export class Library {
	constructor(private readonly core: Core) {}

	/**
	 *
	 * `PUT /api/v1/collections/{code}/items/{shikimori_id}`
	 * @scope `lists:write`
	 */
	addCollectionItem(input: {
		/** the shelf's code */
		code: string;
		/** the shikimori id */
		shikimori_id: number;
		/** the request body */
		body: EntryBody;
	}): Promise<CollectionItem> {
		return this.core.call({
			method: 'PUT',
			path: `/api/v1/collections/${encodeURIComponent(String(input.code))}/items/${encodeURIComponent(String(input.shikimori_id))}`,
			body: input.body,
			scope: 'lists:write',
		});
	}

	/**
	 *
	 * `GET /api/v1/collections/{code}/items`
	 * @scope `lists:read`
	 */
	collectionItems(input: {
		/** the shelf's code */
		code: string;
	}): Promise<Page<CollectionItem>> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/collections/${encodeURIComponent(String(input.code))}/items`,
			scope: 'lists:read',
		});
	}

	/**
	 *
	 * `POST /api/v1/collections`
	 * @scope `lists:write`
	 */
	createCollection(input: {
		/** the request body */
		body: CollectionBody;
	}): Promise<Collection> {
		return this.core.call({
			method: 'POST',
			path: `/api/v1/collections`,
			body: input.body,
			scope: 'lists:write',
		});
	}

	/**
	 *
	 * `GET /api/v1/collections/{code}`
	 * @scope `lists:read`
	 */
	getCollection(input: {
		/** the shelf's code */
		code: string;
	}): Promise<Collection> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/collections/${encodeURIComponent(String(input.code))}`,
			scope: 'lists:read',
		});
	}

	/**
	 *
	 * `GET /api/v1/collections`
	 * @scope `lists:read`
	 */
	listMyCollections(): Promise<Page<Collection>> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/collections`,
			scope: 'lists:read',
		});
	}

	/**
	 * It used to answer the whole thing, which is the bug this api's own rules
	 * already name: a caller with four hundred titles got four hundred rows and a
	 * caller with four thousand got four thousand, and the only reason nobody was
	 * hurt by it is that nobody was using this door. `total` is beside the items
	 * because the paging is by offset, which is exactly when a caller has to know
	 * how far the list goes.
	 *
	 * `GET /api/v1/lists`
	 * @scope `lists:read`
	 */
	listMyList(input?: {
		/** narrow to one shelf: `planned` | `watching` | `rewatching` | `paused` | `done` | `dropped` */
		status?: string;
		/** how many rows, 1-100; 30 by default */
		limit?: number;
		/** where to carry on from */
		offset?: number;
	}): Promise<Page<ListEntry>> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/lists`,
			query: pick(input, ['status', 'limit', 'offset']),
			scope: 'lists:read',
		});
	}

	/**
	 * Every row of `listMyList`, a page at a time.
	 *
	 * Stops when a page comes back shorter than it asked for rather than
	 * when `total` is reached: the list can grow while it is being read, and
	 * counting against a number from the first page walks off the end.
	 */
	async *listMyListAll(input?: {
		/** narrow to one shelf: `planned` | `watching` | `rewatching` | `paused` | `done` | `dropped` */
		status?: string;
		/** how many rows, 1-100; 30 by default */
		limit?: number;
		/** where to carry on from */
		offset?: number;
	}): AsyncGenerator<ListEntry> {
		let offset = input?.offset ?? 0;
		const limit = input?.limit ?? 100;
		for (;;) {
			const page = await this.listMyList({ ...(input as object), limit, offset } as never);
			for (const row of page.items) yield row;
			if (page.items.length < limit) return;
			offset += page.items.length;
		}
	}

	/**
	 * The same `plans::domain::rate` the site calls, so the two doors cannot come
	 * to disagree about what a score is — which is the whole reason the domain
	 * exists. What differs is what this surface always differs by: 404 where the
	 * site answers 204 for a delete that removed nothing.
	 *
	 * `PUT /api/v1/lists/{shikimori_id}/score`
	 * @scope `lists:write`
	 */
	rateListEntry(input: {
		/** the shikimori id */
		shikimori_id: number;
		/** the request body */
		body: ScoreBody;
	}): Promise<ListEntry> {
		return this.core.call({
			method: 'PUT',
			path: `/api/v1/lists/${encodeURIComponent(String(input.shikimori_id))}/score`,
			body: input.body,
			scope: 'lists:write',
		});
	}

	/**
	 *
	 * `DELETE /api/v1/collections/{code}/items/{shikimori_id}`
	 * @scope `lists:write`
	 */
	removeCollectionItem(input: {
		/** the shelf's code */
		code: string;
		/** the shikimori id */
		shikimori_id: number;
	}): Promise<void> {
		return this.core.call({
			method: 'DELETE',
			path: `/api/v1/collections/${encodeURIComponent(String(input.code))}/items/${encodeURIComponent(String(input.shikimori_id))}`,
			empty: true,
			scope: 'lists:write',
		});
	}

	/**
	 *
	 * `DELETE /api/v1/lists/{shikimori_id}`
	 * @scope `lists:write`
	 */
	removeListEntry(input: {
		/** the shikimori id */
		shikimori_id: number;
	}): Promise<void> {
		return this.core.call({
			method: 'DELETE',
			path: `/api/v1/lists/${encodeURIComponent(String(input.shikimori_id))}`,
			empty: true,
			scope: 'lists:write',
		});
	}

	/**
	 *
	 * `PUT /api/v1/lists/{shikimori_id}`
	 * @scope `lists:write`
	 */
	saveListEntry(input: {
		/** the shikimori id */
		shikimori_id: number;
		/** the request body */
		body: ListBody;
	}): Promise<ListEntry> {
		return this.core.call({
			method: 'PUT',
			path: `/api/v1/lists/${encodeURIComponent(String(input.shikimori_id))}`,
			body: input.body,
			scope: 'lists:write',
		});
	}

	/**
	 *
	 * `DELETE /api/v1/lists/{shikimori_id}/score`
	 * @scope `lists:write`
	 */
	unrateListEntry(input: {
		/** the shikimori id */
		shikimori_id: number;
	}): Promise<void> {
		return this.core.call({
			method: 'DELETE',
			path: `/api/v1/lists/${encodeURIComponent(String(input.shikimori_id))}/score`,
			empty: true,
			scope: 'lists:write',
		});
	}
}

/**
 * their writing, and who they read
 */
export class Social {
	constructor(private readonly core: Core) {}

	/**
	 *
	 * `PUT /api/v1/following/{nickname}`
	 * @scope `social:write`
	 */
	followUser(input: {
		/** who to follow */
		nickname: string;
	}): Promise<void> {
		return this.core.call({
			method: 'PUT',
			path: `/api/v1/following/${encodeURIComponent(String(input.nickname))}`,
			empty: true,
			scope: 'social:write',
		});
	}

	/**
	 *
	 * `GET /api/v1/following`
	 * @scope `social:read`
	 */
	listMyFollowing(input?: {
		/** how many rows, 1-100; 30 by default */
		limit?: number;
		/** where to carry on from */
		offset?: number;
	}): Promise<Page<Person>> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/following`,
			query: pick(input, ['limit', 'offset']),
			scope: 'social:read',
		});
	}

	/**
	 * Every row of `listMyFollowing`, a page at a time.
	 *
	 * Stops when a page comes back shorter than it asked for rather than
	 * when `total` is reached: the list can grow while it is being read, and
	 * counting against a number from the first page walks off the end.
	 */
	async *listMyFollowingAll(input?: {
		/** how many rows, 1-100; 30 by default */
		limit?: number;
		/** where to carry on from */
		offset?: number;
	}): AsyncGenerator<Person> {
		let offset = input?.offset ?? 0;
		const limit = input?.limit ?? 100;
		for (;;) {
			const page = await this.listMyFollowing({ ...(input as object), limit, offset } as never);
			for (const row of page.items) yield row;
			if (page.items.length < limit) return;
			offset += page.items.length;
		}
	}

	/**
	 * Not the feed: `social:read` is permission to read *this person's* social
	 * life, not everybody's. A timeline of other people's writing is a different
	 * question with a different answer about who may see what, and it is not
	 * behind this word.
	 *
	 * `GET /api/v1/posts`
	 * @scope `social:read`
	 */
	listMyPosts(input?: {
		/** how many rows, 1-100; 30 by default */
		limit?: number;
		/** where to carry on from */
		offset?: number;
	}): Promise<Page<Post>> {
		return this.core.call({
			method: 'GET',
			path: `/api/v1/posts`,
			query: pick(input, ['limit', 'offset']),
			scope: 'social:read',
		});
	}

	/**
	 * Every row of `listMyPosts`, a page at a time.
	 *
	 * Stops when a page comes back shorter than it asked for rather than
	 * when `total` is reached: the list can grow while it is being read, and
	 * counting against a number from the first page walks off the end.
	 */
	async *listMyPostsAll(input?: {
		/** how many rows, 1-100; 30 by default */
		limit?: number;
		/** where to carry on from */
		offset?: number;
	}): AsyncGenerator<Post> {
		let offset = input?.offset ?? 0;
		const limit = input?.limit ?? 100;
		for (;;) {
			const page = await this.listMyPosts({ ...(input as object), limit, offset } as never);
			for (const row of page.items) yield row;
			if (page.items.length < limit) return;
			offset += page.items.length;
		}
	}

	/**
	 *
	 * `DELETE /api/v1/following/{nickname}`
	 * @scope `social:write`
	 */
	unfollowUser(input: {
		/** who to stop following */
		nickname: string;
	}): Promise<void> {
		return this.core.call({
			method: 'DELETE',
			path: `/api/v1/following/${encodeURIComponent(String(input.nickname))}`,
			empty: true,
			scope: 'social:write',
		});
	}

	/**
	 *
	 * `POST /api/v1/posts`
	 * @scope `social:write`
	 */
	writePost(input: {
		/** the request body */
		body: PostBody;
	}): Promise<Post> {
		return this.core.call({
			method: 'POST',
			path: `/api/v1/posts`,
			body: input.body,
			scope: 'social:write',
		});
	}
}
