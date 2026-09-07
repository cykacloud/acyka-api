// Generated from openapi.json by tools/generate.ts. Do not edit.

namespace Acyka;

/// <summary>
/// The namespaces a client carries.
///
/// Generated, so a tag the server adds arrives without anybody editing the
/// client — and each one is a real property rather than a lookup, which is what
/// an editor needs to complete it.
/// </summary>
public partial class AcykaClient
{
    /// <summary>
    /// the account a token acts for
    /// </summary>
    public AccountApi Account { get; private set; } = null!;

    /// <summary>
    /// titles, people, characters and what is airing
    /// </summary>
    public CatalogueApi Catalogue { get; private set; } = null!;

    /// <summary>
    /// other people, as far as they have agreed to be read
    /// </summary>
    public PeopleApi People { get; private set; } = null!;

    /// <summary>
    /// somebody's own list and shelves
    /// </summary>
    public LibraryApi Library { get; private set; } = null!;

    /// <summary>
    /// their writing, and who they read
    /// </summary>
    public SocialApi Social { get; private set; } = null!;

    private void Attach()
    {
        Account = new AccountApi(Core);
        Catalogue = new CatalogueApi(Core);
        People = new PeopleApi(Core);
        Library = new LibraryApi(Core);
        Social = new SocialApi(Core);
    }
}
