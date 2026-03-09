chrome.runtime.onInstalled.addListener(() => {
  console.log("Rotagotchi extension installed");
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) {
    return;
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      console.log("Rotagotchi action clicked");
    },
  });
});
