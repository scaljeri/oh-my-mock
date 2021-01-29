chrome.devtools.panels.create("My Panel",
    "../assets/images/logo.png",
    "../index.html",
    function(panel) {
      // chrome.runtime.sendMessage({ msg: "Text field changed" }, (response) => {
      //   // If this message's recipient sends a response it will be handled here
      //   if (response) {
      //     // do cool things with the response
      //     // ...
      //   }
      // });
      // code invoked on panel creation
//       chrome.extension.onConnect.addListener(function(port) {
//       console.log("Connected .....");
//       port.onMessage.addListener(function(msg) {
//            console.log("message recieved" + msg);
//            port.postMessage("Hi Popup.js");
//       });
//            port.postMessage("Hi Popup.js");
//  })
    }
);
