using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Acyka;

/// <summary>
/// Checking that a delivery came from us.
///
/// Thirty lines, every one of which is a line somebody gets wrong when they
/// write it themselves — which is why it is in the library rather than in the
/// documentation.
///
/// The three that matter: the raw bytes rather than a parsed body, a
/// constant-time compare, and the timestamp — the signed string is
/// <c>&lt;t&gt;.&lt;body&gt;</c>, so a captured delivery signs valid for ever
/// unless somebody checks how old <c>t</c> is.
/// </summary>
public static class Webhooks
{
    /// <summary>One thing that happened, as it arrives.</summary>
    public sealed record Delivery(string Event, JsonElement Data);

    /// <summary>
    /// The delivery, or a <see cref="BadSignatureException"/>.
    /// </summary>
    /// <param name="body">the request body exactly as it arrived</param>
    /// <param name="signature">the <c>X-Acyka-Signature</c> header</param>
    /// <param name="secret">the endpoint's signing secret</param>
    /// <param name="tolerance">how old a delivery may be, in seconds</param>
    /// <param name="now">for tests</param>
    public static Delivery Verify(
        ReadOnlySpan<byte> body,
        string? signature,
        string secret,
        int tolerance = 300,
        long? now = null)
    {
        if (string.IsNullOrEmpty(signature))
        {
            throw new BadSignatureException("there was no signature header");
        }

        long? at = null;
        string? said = null;
        foreach (var piece in signature.Split(','))
        {
            var split = piece.IndexOf('=');
            if (split < 0)
            {
                continue;
            }
            var key = piece[..split].Trim();
            var value = piece[(split + 1)..].Trim();
            if (key == "t" && long.TryParse(value, out var seen))
            {
                at = seen;
            }
            else if (key == "v1" && value.Length > 0)
            {
                said = value;
            }
        }

        if (at is null || said is null)
        {
            throw new BadSignatureException("the header was not `t=…,v1=…`");
        }

        var seconds = now ?? DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        // Both directions. A delivery from the future is a clock that is wrong,
        // and accepting it would mean accepting one whose `t` an attacker chose.
        var age = Math.Abs(seconds - at.Value);
        if (age > tolerance)
        {
            throw new BadSignatureException($"it is {age}s old, and the tolerance is {tolerance}s");
        }

        var signed = new byte[Encoding.UTF8.GetByteCount($"{at.Value}.") + body.Length];
        var written = Encoding.UTF8.GetBytes($"{at.Value}.", signed);
        body.CopyTo(signed.AsSpan(written));

        var expected = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), signed);
        byte[] presented;
        try
        {
            presented = Convert.FromHexString(said);
        }
        catch (FormatException)
        {
            throw new BadSignatureException("the header was not `t=…,v1=…`");
        }

        // Constant time. `SequenceEqual` returns as soon as two bytes differ,
        // and how long that took measures how much of the signature was right —
        // a hundred requests per byte, and a forgeable signature at the end.
        if (!CryptographicOperations.FixedTimeEquals(expected, presented))
        {
            throw new BadSignatureException("it does not match the body");
        }

        using var parsed = JsonDocument.Parse(body.ToArray());
        var root = parsed.RootElement;
        return new Delivery(
            root.TryGetProperty("event", out var kind) ? kind.GetString() ?? "" : "",
            root.TryGetProperty("data", out var data) ? data.Clone() : default);
    }

    /// <summary>The same, for a caller holding the body as text.</summary>
    public static Delivery Verify(string body, string? signature, string secret, int tolerance = 300, long? now = null) =>
        Verify(Encoding.UTF8.GetBytes(body), signature, secret, tolerance, now);
}

/// <summary>A delivery that is not ours, or not this minute's.</summary>
public sealed class BadSignatureException : Exception
{
    internal BadSignatureException(string why)
        : base($"the webhook signature did not check out: {why}") { }
}
