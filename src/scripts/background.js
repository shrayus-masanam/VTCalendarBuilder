chrome.action.onClicked.addListener(async (tab) => {
    if (!tab.id) return;
    await chrome.scripting.executeScript({
        target: {
            tabId: tab.id,
            allFrames: false
        },
        files: ['scripts/vendor/temporal-polyfill/global.min.js', 'scripts/inject.js'],
    });
});
