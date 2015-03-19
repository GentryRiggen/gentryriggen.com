using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace gentryriggen.models
{
    public class Utils
    {
        static string CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        static int TOKEN_LENGTH = 64;

        public static string CreateSecret()
        {
            var random = new Random();
            return new string(Enumerable.Repeat(CHARS, TOKEN_LENGTH).Select(s => s[random.Next(s.Length)]).ToArray());
        }
    }
}
