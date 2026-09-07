using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Acyka;
using Xunit;

namespace Acyka.Tests;

/// <summary>
/// Verification is the one piece of this library that is a security boundary
/// rather than a convenience, so the tests are the attacks.
/// </summary>
public class WebhookTests
{
    private const string Secret = "acyw_0123456789abcdef";
    private const string Body = """{"event":"list.saved","data":{"shikimori_id":21}}""";
    private const long Now = 1_700_000_000;

    private static string Sign(string body, long at, string secret = Secret)
    {
        var mac = HMACSHA256.HashData(
            Encoding.UTF8.GetBytes(secret),
            Encoding.UTF8.GetBytes($"{at}.{body}"));
        return $"t={at},v1={Convert.ToHexStringLower(mac)}";
    }

    [Fact]
    public void A_delivery_that_is_ours_comes_back_parsed()
    {
        var delivered = Webhooks.Verify(Body, Sign(Body, Now), Secret, now: Now);
        Assert.Equal("list.saved", delivered.Event);
        Assert.Equal(21, delivered.Data.GetProperty("shikimori_id").GetInt32());
    }

    [Fact]
    public void A_body_edited_after_signing()
    {
        var signature = Sign(Body, Now);
        const string tampered = """{"event":"list.saved","data":{"shikimori_id":22}}""";
        Assert.Throws<BadSignatureException>(() => Webhooks.Verify(tampered, signature, Secret, now: Now));
    }

    [Fact]
    public void A_signature_made_with_another_secret()
    {
        var signature = Sign(Body, Now, "acyw_someone_elses");
        Assert.Throws<BadSignatureException>(() => Webhooks.Verify(Body, signature, Secret, now: Now));
    }

    [Fact]
    public void A_replay_of_a_real_delivery_from_an_hour_ago()
    {
        // The whole reason the timestamp is inside the signed string: signing
        // the body alone gives a signature that never stops being valid.
        var refused = Assert.Throws<BadSignatureException>(
            () => Webhooks.Verify(Body, Sign(Body, Now - 3600), Secret, now: Now));
        Assert.Contains("3600s old", refused.Message);
    }

    [Fact]
    public void A_delivery_from_the_future_which_is_a_clock_somebody_chose()
    {
        Assert.Throws<BadSignatureException>(
            () => Webhooks.Verify(Body, Sign(Body, Now + 3600), Secret, now: Now));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("deadbeef")]
    [InlineData("v1=deadbeef")]
    [InlineData("t=notanumber,v1=x")]
    public void A_header_that_is_missing_or_in_some_other_shape(string? nonsense)
    {
        Assert.Throws<BadSignatureException>(() => Webhooks.Verify(Body, nonsense, Secret, now: Now));
    }

    [Fact]
    public void A_signature_of_the_right_length_that_is_wrong()
    {
        // The constant-time compare's own case: right length, every byte wrong.
        var wrong = $"t={Now},v1={new string('0', 64)}";
        var refused = Assert.Throws<BadSignatureException>(() => Webhooks.Verify(Body, wrong, Secret, now: Now));
        Assert.Contains("does not match", refused.Message);
    }

    [Fact]
    public void The_tolerance_is_five_minutes_and_movable()
    {
        Webhooks.Verify(Body, Sign(Body, Now - 290), Secret, now: Now);
        var older = Sign(Body, Now - 310);
        Assert.Throws<BadSignatureException>(() => Webhooks.Verify(Body, older, Secret, now: Now));
        // a caller who knows their queue is slow can say so
        Webhooks.Verify(Body, older, Secret, tolerance: 600, now: Now);
    }
}

/// <summary>The two flows that can be tested without a server.</summary>
public class FlowTests
{
    [Fact]
    public void A_pkce_pair_is_the_challenge_of_its_own_verifier()
    {
        var pair = Flows.Pkce();
        var digest = SHA256.HashData(Encoding.UTF8.GetBytes(pair.Verifier));
        var expected = Convert.ToBase64String(digest).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        Assert.Equal(expected, pair.Challenge);
        // 32 bytes, base64url with no padding
        Assert.Equal(43, pair.Verifier.Length);
        Assert.DoesNotContain("=", pair.Verifier);
        Assert.DoesNotContain("+", pair.Verifier);
        Assert.NotEqual(Flows.Pkce().Verifier, Flows.Pkce().Verifier);
    }

    [Fact]
    public void An_authorize_url_always_carries_a_state()
    {
        var asked = Flows.AuthorizeUrl(
            "acy_x",
            "https://example.com/cb",
            ["openid", "profile"],
            "chal");

        // Generated when it was not given, so there is no way to end up with a
        // callback that has nothing to compare against.
        Assert.NotEmpty(asked.State);
        Assert.Contains("code_challenge_method=S256", asked.Url);
        Assert.Contains("state=", asked.Url);
    }
}
