using System;
using System.Collections.Generic;
using System.Configuration;
using System.Linq;
using System.Web;

namespace gentryriggen.Utils
{
    public class Utilities
    {
        public static string GetSetting(string settingName)
        {
            return ConfigurationManager.AppSettings[settingName];
        }

        public static string GetConnectionString(string connName)
        {
            return ConfigurationManager.ConnectionStrings[connName].ConnectionString;
        }

        public static Int32 GetEpochTimeNow()
        {
            return (Int32)(DateTime.UtcNow.Subtract(new DateTime(1970, 1, 1))).TotalSeconds;
        }

    }
}