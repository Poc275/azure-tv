# Develop/Build Issue
There's a conflict in the dev/build due to the fact that the site is deployed to a folder at https://poc275.me/azure-tv. When developing, clear the `/.parcel-cache` and `/dist` folders so the files are served from root. Then repeat when building so the files are served from the correct folder.

