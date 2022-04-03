const init = () => {
    cast.framework.CastContext.getInstance().setOptions({
        receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID
    });

    const context = cast.framework.CastContext.getInstance();
    context.addEventListener(cast.framework.CastContextEventType.SESSION_STATE_CHANGED, (event) => {
        switch (event.sessionState) {
            case cast.framework.SessionState.SESSION_STARTED:
            case cast.framework.SessionState.SESSION_RESUMED:
                console.log('CastContext: CastSession started or resumed');
                // play();
                break;
            case cast.framework.SessionState.SESSION_ENDED:
                console.log('CastContext: CastSession disconnected');
                // Update locally as necessary
                break;
        }
    });
};

window['__onGCastApiAvailable'] = (isAvailable) => {
    if (isAvailable) {
        init();
    }
};