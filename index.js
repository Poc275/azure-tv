import * as msal from "@azure/msal-browser";

const msalConfig = {
    auth: {
        clientId: '53bfecae-5150-4a44-8b5b-957ac4839fa4',
        authority: 'https://login.microsoftonline.com/4583a017-e1c7-4872-bb63-71c8f247fb02'
    }
};

const msalInstance = new msal.PublicClientApplication(msalConfig);

// need to handle the redirect promise when using the redirect login instead of popup
msalInstance.handleRedirectPromise().then((tokenResponse) => {
    // Check if the tokenResponse is null
    // If the tokenResponse !== null, then you are coming back from a successful authentication redirect. 
    // If the tokenResponse === null, you are not coming back from an auth redirect.
    if(tokenResponse) {
        // console.log(tokenResponse);
        // const myAccounts = msalInstance.getAllAccounts();
        // console.log(myAccounts);

        fetch("https://azuretv.blob.core.windows.net/?comp=list", {
            headers: {
                "x-ms-version": "2017-11-09",
                "Authorization": `Bearer ${tokenResponse.accessToken}`
            }
        })
        .then(res => res.text())
        .then(data => console.log(data))
        .catch(err => console.error(err));
    } else {
        try {
            const loginRequest = {
                scopes: ["https://storage.azure.com/user_impersonation"]
            };
            msalInstance.loginRedirect(loginRequest);
        } catch (err) {
            // handle error
            console.error(err);
        }
    }
}).catch((error) => {
    // handle error, either in the library or coming back from the server
    console.error(error);
});
