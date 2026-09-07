using System.Text.Json;

namespace Acyka;

/// <summary>
/// One type per refusal, out of a set the server keeps small on purpose.
///
/// The api answers <c>{"message": "errors.oauthInsufficientScope"}</c> — a
/// phrase name and never a sentence — because one screen can be read in five
/// languages and the server does not get to choose which. For a client that is
/// not a limitation but the thing that makes real types possible: a stable,
/// enumerable set of names, instead of matching on prose that changes when
/// somebody rewrites a sentence.
/// </summary>
public class AcykaException : Exception
{
    internal AcykaException(int status, string code, JsonElement detail, string request, Exception? inner = null)
        : base($"{code} ({status} for {request})", inner)
    {
        Status = status;
        Code = code;
        Detail = detail;
        Request = request;
    }

    public int Status { get; }

    /// <summary>The phrase name, e.g. <c>errors.notFound</c>.</summary>
    public string Code { get; }

    /// <summary>The whole body, including the extra fields a refusal owes a reason for.</summary>
    public JsonElement Detail { get; }

    /// <summary>What was asked, for a log that has to be read six months later.</summary>
    public string Request { get; }

    /// <summary>Whether asking again could plausibly answer differently.</summary>
    public virtual bool Retryable => false;

    /// <summary>A named string out of the extra fields, where there is one.</summary>
    public string? Field(string name) =>
        Detail.ValueKind == JsonValueKind.Object
        && Detail.TryGetProperty(name, out var value)
        && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
}

/// <summary>No token, an expired one, or one whose application was switched off.</summary>
public sealed class UnauthorizedException : AcykaException
{
    internal UnauthorizedException(string code, JsonElement detail, string request)
        : base(401, code, detail, request) { }
}

/// <summary>
/// The token is good and does not carry what this endpoint wants.
///
/// Refreshing will not help, which is why this is not
/// <see cref="UnauthorizedException"/>: the refresh produces the same token
/// with the same scopes and earns the same refusal.
/// </summary>
public sealed class ForbiddenException : AcykaException
{
    internal ForbiddenException(string code, JsonElement detail, string request)
        : base(403, code, detail, request) { }

    /// <summary>The word that was missing, where the server named it.</summary>
    public string? Scope => Field("scope");
}

public sealed class NotFoundException : AcykaException
{
    internal NotFoundException(string code, JsonElement detail, string request)
        : base(404, code, detail, request) { }
}

/// <summary>Refused before anything looked at it.</summary>
public sealed class BadRequestException : AcykaException
{
    internal BadRequestException(int status, string code, JsonElement detail, string request)
        : base(status, code, detail, request) { }
}

/// <summary>
/// The minute is spent.
///
/// <see cref="RetryAfter"/> is seconds, from the server's own header. This only
/// reaches a caller when the retries are used up or turned off — otherwise the
/// client waits and tries again by itself.
/// </summary>
public sealed class RateLimitedException : AcykaException
{
    internal RateLimitedException(string code, JsonElement detail, string request, int retryAfter, Pace pace)
        : base(429, code, detail, request)
    {
        RetryAfter = retryAfter;
        Pace = pace;
    }

    public int RetryAfter { get; }

    public Pace Pace { get; }

    public override bool Retryable => true;
}

public sealed class ServerException : AcykaException
{
    internal ServerException(int status, string code, JsonElement detail, string request)
        : base(status, code, detail, request) { }

    public override bool Retryable => true;
}

/// <summary>
/// A status this client has no name for, which is a server that has grown one —
/// and a client that threw something unhelpful would be worse than one that
/// hands it over.
/// </summary>
public sealed class UnexpectedException : AcykaException
{
    internal UnexpectedException(int status, string code, JsonElement detail, string request)
        : base(status, code, detail, request) { }
}

/// <summary>The request never got an answer: a socket, a timeout, a proxy.</summary>
public sealed class UnreachableException : AcykaException
{
    internal UnreachableException(string request, Exception inner)
        : base(0, "errors.unreachable", default, request, inner) { }

    public override bool Retryable => true;
}

/// <summary>
/// The answer arrived and was not the shape the contract says.
///
/// Its own type rather than folded into <see cref="UnreachableException"/>,
/// because the two mean opposite things about what to do next: a socket is worth
/// retrying and a shape that does not parse never will be.
/// </summary>
public sealed class MalformedException : AcykaException
{
    internal MalformedException(string request, Exception inner)
        : base(0, "errors.malformed", default, request, inner) { }
}

/// <summary>The token endpoint refused, as RFC 6749 names it.</summary>
public sealed class OauthException : Exception
{
    internal OauthException(string error, string? description)
        : base(description is null ? error : $"{error}: {description}")
    {
        Error = error;
        Description = description;
    }

    public string Error { get; }

    public string? Description { get; }
}

/// <summary>What the server said about the caller's minute.</summary>
public readonly record struct Pace(long? Limit = null, long? Remaining = null, long? Reset = null);

internal static class Refusals
{
    internal static AcykaException Of(int status, string code, JsonElement detail, string request, int retryAfter, Pace pace) =>
        status switch
        {
            400 or 422 => new BadRequestException(status, code, detail, request),
            401 => new UnauthorizedException(code, detail, request),
            403 => new ForbiddenException(code, detail, request),
            404 => new NotFoundException(code, detail, request),
            429 => new RateLimitedException(code, detail, request, retryAfter, pace),
            >= 500 => new ServerException(status, code, detail, request),
            _ => new UnexpectedException(status, code, detail, request),
        };
}
