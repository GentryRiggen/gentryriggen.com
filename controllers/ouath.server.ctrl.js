var express = require('express'),
  path = require('path');

var ctrl = express.Router();

ctrl.route('/')
  .get(function (req, res) {
    // https://login.live.com/oauth20_authorize.srf?client_id=000000004416F61F&scope=mshealth.ReadProfile mshealth.ReadDevices mshealth.ReadActivityHistory mshealth.ReadActivityLocation&response_type=code&redirect_uri=http://local.gentryriggen.com:8000/redirect
    // https://login.live.com/oauth20_authorize.srf?client_id=000000004416F61F&scope=mshealth.ReadProfile mshealth.ReadDevices mshealth.ReadActivityHistory mshealth.ReadActivityLocation&response_type=code&redirect_uri=https://login.live.com/oauth20_desktop.srf
    // My Access Token: EwCoAvF0BAAUkWhN6f8bO0%2bg89MA1fmZueWyRkQAAbhMipx/ZCzLnBiO6aRl5LwMMtjn%2bGLcVb7iyoq2v0PrVcmMHbZJsRXwoksJjXrTOnSKg8hLPB3HDeLk91EFqJ7F0m%2b/TCuB03A39OkS7V4FDUj9AoDYgX8DYMjXhjRla6aHDRXSChbP9S5oNiUeD5PRHvJPAOpCeJWwKPzFJ9AJCxlQjGdRwjKvRb3b0Ag8XDujcqOGnsBp/ybvaQwJSD3YVRu2remynUl3o24idrpCNzDmqu8vc0v718VxxqfaxS5t/Bd5akQv0gprXSNL%2bYnO5MVs5ZxPHRKKtduXf4PTfA9SSXmgpU5Dh9iQl5BfVgfXNYpOQ5NOf96AaZv/ZjQDZgAACFAxXqRZvF8BeAEIixfBuTgNvqRl1aLRebnChsLdSYXCvFPTQTDBXwfv9A%2bIu8haocP0bJMOca9WEUbXrWl/zfED5KRFqi2O5VEHqsDtjHn4BR7f/XRjRxzB2NaZRbLqJpFXxPhRDQzPcMLnO9kzkvM8DeZK0he8KJ2pBR73O1LWSjmc74BzFhs/aYTm2fExzpED8odSLpzLFEzv9e7PSsr0wJ813HOYUihMJNm5LGmphjEh0Ct5Vg42%2bM/NW0pc1jFMtLreDNob%2bAycNzQb5ljL2zlpnOHqCeccZuq2RGtViFPLy0LWP%2b0yL3mlfN3hx7N0TsOa2B7HgNcX3xrD3IOejDRKD9WIiMoycZzh%2bkM772GR1lJjHa%2bBtORNYcUlsvouXbSL5K2u%2bdxV5wCQ36XeRWVZ8DnY662AtCE0OZ%2bLFo3F5uEPPgtA/VR9vhL8RexeQNhsndyO4cOyCDszTKK96VrGef/7jpKWKazWAUlU%2bNt1%2bJVO9hAQ8WRT/eQxS0aSkQE%3d
    // token_type=bearer
    // expires_in=3600
    // scope=mshealth.readprofile%20mshealth.readdevices%20mshealth.readactivityhistory%20mshealth.readactivitylocation
    // authentication_token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImtpZCI6IjEifQ.eyJ2ZXIiOjEsImlzcyI6InVybjp3aW5kb3dzOmxpdmVpZCIsImV4cCI6MTQ0ODMyNDEzNywidWlkIjoiNDMwYTIwM2I0NjBmNjIwYzY5N2FkNzg2OWFhYjQ1MmYiLCJhdWQiOiJnZW50cnlyaWdnZW4uY29tIiwidXJuOm1pY3Jvc29mdDphcHB1cmkiOiJhcHBpZDovLzAwMDAwMDAwNDQxNkY2MUYiLCJ1cm46bWljcm9zb2Z0OmFwcGlkIjoiMDAwMDAwMDA0NDE2RjYxRiJ9.TJM8br4JebDpPLjUGEYq0ZUt1-Rr5SefNj2UqXL24og
    // user_id=430a203b460f620c697ad7869aab452f
    res.sendFile(path.join(__dirname, 'ouathIndex.html'));
  });

module.exports = ctrl;

