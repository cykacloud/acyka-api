// Generated from openapi.json by tools/generate.ts. Do not edit.

package cc.acyka.api

/**
 * The namespaces a client carries.
 *
 * Generated, so a tag the server adds arrives without anybody editing the
 * client — and each one is a real property rather than a lookup, which is what
 * an editor needs to complete it.
 */
public abstract class Namespaces internal constructor(internal val core: Core) {

    /**
     * the account a token acts for
     */
    public val account: Account = Account(core)

    /**
     * titles, people, characters and what is airing
     */
    public val catalogue: Catalogue = Catalogue(core)

    /**
     * other people, as far as they have agreed to be read
     */
    public val people: People = People(core)

    /**
     * somebody's own list and shelves
     */
    public val library: Library = Library(core)

    /**
     * their writing, and who they read
     */
    public val social: Social = Social(core)
}
