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

        // TODO - Look up &delimiter=/&prefix=TV Shows/ to traverse the folders
        // or just use the SDK to make life easier?
        // Use metadata on blobs for show info?
        // TODO - Blobs need public access to play via Chromecast - D'oh!
        fetch("https://azuretv.blob.core.windows.net/media?restype=container&comp=list", {
            headers: {
                "x-ms-version": "2017-11-09",
                "Authorization": `Bearer ${tokenResponse.accessToken}`
            }
        })
        .then(res => res.text())
        .then(data => {
            // console.log(data);
            const parser = new DOMParser();
            const blobsXml = parser.parseFromString(data, "application/xml");
            console.log(blobsXml);

            const blobs = blobsXml.getElementsByTagName("Blob");
            for (let i = 0; i < blobs.length; i++) {   
                const path = blobs[i].getElementsByTagName("Name")[0].textContent;
                // console.log(encodeURI(path));
                console.log(`https://azuretv.blob.core.windows.net/media/${encodeURI(path)}`);
                const episodeName = path.split('/')[3].split('-')[1].replace('.m4v', '');
                const episodeNumber = path.split('/')[3].split('-')[0];

                const mimeType = blobs[i].getElementsByTagName("Properties")[0]
                    .getElementsByTagName("Content-Type")[0].textContent;
                console.log(mimeType);

                const libraryDiv = document.getElementById("library");
                const showDiv = document.createElement("div");
                const showNamePara = document.createElement("p");
                showNamePara.textContent = episodeName;

                const playBtn = document.createElement("button");
                playBtn.innerHTML = "Play";
                playBtn.onclick = () => {
                    const castSession = cast.framework.CastContext.getInstance().getCurrentSession();
                    const metadata = new chrome.cast.media.TvShowMediaMetadata();
                    metadata.episode = episodeNumber;
                    metadata.images = [
                        "https://m.media-amazon.com/images/M/MV5BMTczMDEwNzY2Nl5BMl5BanBnXkFtZTYwNjg3NzA5._V1_.jpg"
                    ];
                    metadata.originalAirdate = "1999-07-05";
                    metadata.season = 2;
                    metadata.title = episodeName;
                    const mediaInfo = new chrome.cast.media.MediaInfo(
                        // `https://azuretv.blob.core.windows.net/media/${path}`,
                        "https://dghwarehousestrapi.blob.core.windows.net/dgh-warehouse-strapi/1-BackToSchool.m4v",
                        mimeType);
                    mediaInfo.metadata = metadata;
                    const request = new chrome.cast.media.LoadRequest(mediaInfo);
                    castSession.loadMedia(request)
                        .then(() => { 
                            console.log('Load succeeded');
                        }).catch((err) => {
                            console.log('Error code', err);
                        });
                };

                showDiv.appendChild(showNamePara);
                showDiv.appendChild(playBtn);
                libraryDiv.appendChild(showDiv);
            }
        })
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
