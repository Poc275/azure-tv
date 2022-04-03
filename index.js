import * as msal from "@azure/msal-browser";
import { BlobServiceClient } from "@azure/storage-blob";
import db from './db.json';

const msalConfig = {
    auth: {
        clientId: '53bfecae-5150-4a44-8b5b-957ac4839fa4',
        authority: 'https://login.microsoftonline.com/4583a017-e1c7-4872-bb63-71c8f247fb02'
    }
};

const msalInstance = new msal.PublicClientApplication(msalConfig);

// need to handle the redirect promise when using the redirect login instead of popup
msalInstance.handleRedirectPromise().then(async (tokenResponse) => {
    // Check if the tokenResponse is null
    // If the tokenResponse !== null, then you are coming back from a successful authentication redirect. 
    // If the tokenResponse === null, you are not coming back from an auth redirect.
    if(tokenResponse) {
        // console.log(tokenResponse);
        // const myAccounts = msalInstance.getAllAccounts();
        // console.log(myAccounts);

        const tokenCredential = {
            getToken() {
                return {
                    token: tokenResponse.accessToken,
                    expiresOnTimestamp: Date.now() + 60 * 60 * 1000,
                };
            }
        };

        const blobServiceClient = new BlobServiceClient("https://azuretv.blob.core.windows.net/", tokenCredential);
        // console.log(blobServiceClient);

        // Have to set a default version of the REST API later than 2011-08-18 to be able to stream (HTTP 206 Accept bytes)
        // blobServiceClient.setProperties({
        //     defaultServiceVersion: "2021-04-10"
        // }).then(res => console.log("Set Properties response", res))
        // .catch(err => console.error("Set Properties error", err));

        // Check API default version
        // blobServiceClient.getProperties()
        //     .then(res => console.log("Get Properties response", res))
        //     .catch(err => console.error("Get Properties error", err));

        const containerClient = blobServiceClient.getContainerClient("media");

        // get just TV shows
        for await (const item of containerClient.listBlobsByHierarchy("/", { prefix: "TV/" })) {
            // console.log(item);
            if(item.kind === "prefix") {
                // console.log(`\tBlobPrefix: ${item.name}`);
                const tmdbId = item.name.split("/")[1];
                const showData = db[tmdbId];

                const img = document.createElement("img");
                img.src = `https://image.tmdb.org/t/p/w92/${showData.poster_path}`;
                img.alt = `${showData.name} poster`;

                const title = document.createElement("p");
                title.className = "poster-title";
                title.textContent = showData.name;

                const link = document.createElement("a");
                link.href = `show.html?id=${showData.id}`;
                link.appendChild(img);
                link.appendChild(title);

                const div = document.createElement("div");
                div.className = "poster";
                div.appendChild(link);
                
                const libraryDiv = document.getElementById("library");
                libraryDiv.appendChild(div);
            }
        }
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
