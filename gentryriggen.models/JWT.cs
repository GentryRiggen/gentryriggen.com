using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;

namespace gentryriggen.models
{
    public enum JwtHashAlgorithm
    {
        HS256,
        HS384,
        HS512
    }

    public class JWT
    {
        private const int DEFAULT_EXPIRATION_TIME = 2592000;
        private const string DEFAULT_ISSUER = "gentryriggen.com";
        public string UserId { get; set; }
        public int ExpirationEpoch { get; set; }
        public IEnumerable<string> Claims { get; set; }

        private static Dictionary<JwtHashAlgorithm, Func<byte[], byte[], byte[]>> HashAlgorithms;

        static JWT()
        {
            HashAlgorithms = new Dictionary<JwtHashAlgorithm, Func<byte[], byte[], byte[]>>
            {
                { JwtHashAlgorithm.HS256, (key, value) => { using (var sha = new HMACSHA256(key)) { return sha.ComputeHash(value); } } },
                { JwtHashAlgorithm.HS384, (key, value) => { using (var sha = new HMACSHA384(key)) { return sha.ComputeHash(value); } } },
                { JwtHashAlgorithm.HS512, (key, value) => { using (var sha = new HMACSHA512(key)) { return sha.ComputeHash(value); } } }
            };
        }

        public JWT(string userId, IEnumerable<string> claims)
        {
            this.UserId = userId;
            this.Claims = claims; 
        }

        public JWT(string token, string secret, bool verify = true)
        {
            string decodedToken = JWT.Decode(token, secret, verify);
            JObject tokenObj = JObject.Parse(decodedToken);
            Dictionary<string, string> tokenDict = tokenObj.ToObject<Dictionary<string, string>>();
            string claims = "";
            foreach (KeyValuePair<string, JToken> pair in tokenObj)
            {
                switch (pair.Key)
                {
                    case "exp":
                        this.ExpirationEpoch = Convert.ToInt32(pair.Value);
                        if (this.ExpirationEpoch < 1) throw new Exception("No Expiration Present!");
                        break;
                    case "sub":
                        this.UserId = pair.Value.ToString();
                        if (String.IsNullOrEmpty(this.UserId)) throw new Exception("No User Id Present!");
                        break;
                    case "claims":
                        claims = pair.Value.ToString();
                        break;
                }
            }

            this.Claims = claims.Split(',').ToList();
        }

        public string ToJWTString(string secret)
        {
            string rolesAsCSV = String.Join(",", Claims);
            Int32 epochTimeNow = JWT.GetEpochTimeNow();
            Int32 expirationNow = epochTimeNow + DEFAULT_EXPIRATION_TIME;
            var payload = new
            {
                iss = DEFAULT_ISSUER,
                iat = epochTimeNow,
                exp = expirationNow,
                sub = UserId,
                claims = rolesAsCSV
            };
            return Encode(payload, secret, JwtHashAlgorithm.HS256);
        }

        public static string Encode(object payload, string key, JwtHashAlgorithm algorithm)
        {
            var segments = new List<string>();
            var header = new { typ = "JWT", alg = algorithm.ToString() };

            JsonSerializerSettings jsonSettings = new JsonSerializerSettings();
            jsonSettings.NullValueHandling = NullValueHandling.Ignore;
            jsonSettings.DefaultValueHandling = DefaultValueHandling.Ignore;

            byte[] headerBytes = Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(header, Formatting.None));
            byte[] payloadBytes = Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(payload, Formatting.None, jsonSettings));

            segments.Add(Base64UrlEncode(headerBytes));
            segments.Add(Base64UrlEncode(payloadBytes));

            var stringToSign = string.Join(".", segments.ToArray());

            var bytesToSign = Encoding.UTF8.GetBytes(stringToSign);
            var keyBytes = Encoding.UTF8.GetBytes(key);

            byte[] signature = HashAlgorithms[algorithm](keyBytes, bytesToSign);
            segments.Add(Base64UrlEncode(signature));

            return string.Join(".", segments.ToArray());
        }

        public static string Decode(string token, string key)
        {
            return Decode(token, key, true);
        }

        public static string Decode(string token, string key, bool verify)
        {
            var parts = token.Split('.');
            var header = parts[0];
            var payload = parts[1];
            byte[] crypto = Base64UrlDecode(parts[2]);

            var headerJson = Encoding.UTF8.GetString(Base64UrlDecode(header));
            var headerData = JObject.Parse(headerJson);
            var payloadJson = Encoding.UTF8.GetString(Base64UrlDecode(payload));
            var payloadData = JObject.Parse(payloadJson);

            if (verify)
            {
                var bytesToSign = Encoding.UTF8.GetBytes(string.Concat(header, ".", payload));
                var keyBytes = Encoding.UTF8.GetBytes(key);
                var algorithm = (string)headerData["alg"];

                var signature = HashAlgorithms[GetHashAlgorithm(algorithm)](keyBytes, bytesToSign);
                var decodedCrypto = Convert.ToBase64String(crypto);
                var decodedSignature = Convert.ToBase64String(signature);

                if (decodedCrypto != decodedSignature)
                {
                    throw new ApplicationException(string.Format("Invalid signature. Expected {0} got {1}", decodedCrypto, decodedSignature));
                }
            }

            return payloadJson;
        }

        private static JwtHashAlgorithm GetHashAlgorithm(string algorithm)
        {
            switch (algorithm)
            {
                case "HS256": return JwtHashAlgorithm.HS256;
                case "HS384": return JwtHashAlgorithm.HS384;
                case "HS512": return JwtHashAlgorithm.HS512;
                default: throw new InvalidOperationException("Algorithm not supported.");
            }
        }

        // from JWT spec
        private static string Base64UrlEncode(byte[] input)
        {
            var output = Convert.ToBase64String(input);
            output = output.Split('=')[0]; // Remove any trailing '='s
            output = output.Replace('+', '-'); // 62nd char of encoding
            output = output.Replace('/', '_'); // 63rd char of encoding
            return output;
        }

        // from JWT spec
        private static byte[] Base64UrlDecode(string input)
        {
            var output = input;
            output = output.Replace('-', '+'); // 62nd char of encoding
            output = output.Replace('_', '/'); // 63rd char of encoding
            switch (output.Length % 4) // Pad with trailing '='s
            {
                case 0: break; // No pad chars in this case
                case 2: output += "=="; break; // Two pad chars
                case 3: output += "="; break; // One pad char
                default: throw new System.Exception("Illegal base64url string!");
            }
            var converted = Convert.FromBase64String(output); // Standard base64 decoder
            return converted;
        }

        public static Int32 GetEpochTimeNow()
        {
            return (Int32)(DateTime.UtcNow.Subtract(new DateTime(1970, 1, 1))).TotalSeconds;
        }
    }
}
